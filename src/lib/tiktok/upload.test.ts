import { afterEach, describe, expect, it, vi } from "vitest";
import { planChunks, uploadVideoChunks } from "./upload";

const MB = 1024 * 1024;
const MIN_CHUNK = 5 * MB;
const MAX_CHUNK = 64 * MB;

/**
 * TikTok's stated invariants (docs/integration/TIKTOK_CONTENT_POSTING_DEMO.md,
 * re-verified against developers.tiktok.com/doc/content-posting-api-media-transfer-guide):
 *   - videos <5MB are sent as a single chunk equal to the whole file
 *   - otherwise every chunk is 5MB-64MB, except the final chunk, which may
 *     be larger (never smaller than the declared chunk_size)
 *   - 1-1000 total chunks
 */
function assertPlanIsSpecCompliant(fileSize: number) {
  const plan = planChunks(fileSize);
  expect(plan.videoSize).toBe(fileSize);
  expect(plan.totalChunkCount).toBeGreaterThanOrEqual(1);
  expect(plan.totalChunkCount).toBeLessThanOrEqual(1000);

  if (plan.totalChunkCount === 1) {
    // Single-chunk case: chunk_size must equal the whole file, whatever its size.
    expect(plan.chunkSize).toBe(fileSize);
  } else {
    expect(plan.chunkSize).toBeGreaterThanOrEqual(MIN_CHUNK);
    expect(plan.chunkSize).toBeLessThanOrEqual(MAX_CHUNK);
  }

  // Reconstruct the exact byte ranges uploadVideoChunks will send and verify
  // they exactly cover [0, fileSize) with no gap/overlap, and the final
  // chunk is never smaller than the declared chunk_size.
  let coveredBytes = 0;
  for (let i = 0; i < plan.totalChunkCount; i++) {
    const start = i * plan.chunkSize;
    const isLast = i === plan.totalChunkCount - 1;
    const end = isLast ? plan.videoSize - 1 : start + plan.chunkSize - 1;
    const size = end - start + 1;
    expect(start).toBe(coveredBytes);
    if (isLast) {
      expect(size).toBeGreaterThanOrEqual(plan.chunkSize);
    } else {
      expect(size).toBe(plan.chunkSize);
    }
    coveredBytes = end + 1;
  }
  expect(coveredBytes).toBe(fileSize);
}

describe("planChunks — boundary sizes required by the audit", () => {
  const boundaries: Array<[string, number]> = [
    ["4MB (below the 5MB single-chunk cutoff)", 4 * MB],
    ["exactly 5MB (the single-chunk cutoff)", 5 * MB],
    ["5MB + 1 byte (just above the cutoff — regression case for the ceil/floor fix)", 5 * MB + 1],
    ["exactly 64MB (the max per-chunk size)", 64 * MB],
    ["65MB (just above the max per-chunk size)", 65 * MB],
    ["200MB", 200 * MB],
  ];

  it.each(boundaries)("%s is spec-compliant", (_label, size) => {
    assertPlanIsSpecCompliant(size);
  });

  it("5MB + 1 byte plans a single chunk equal to the file — not a 10MB chunk_size for a 5MB file (the bug this test guards against)", () => {
    const plan = planChunks(5 * MB + 1);
    expect(plan.totalChunkCount).toBe(1);
    expect(plan.chunkSize).toBe(5 * MB + 1);
  });

  it("200MB plans a clean 20 x 10MB split", () => {
    const plan = planChunks(200 * MB);
    expect(plan.totalChunkCount).toBe(20);
    expect(plan.chunkSize).toBe(10 * MB);
  });

  it("sweeps a wide range of sizes around every multiple of the default 10MB chunk size", () => {
    for (let base = 1; base <= 210; base++) {
      const sizeMB = base * MB;
      for (const delta of [-MB, -1, 0, 1, MB]) {
        const size = sizeMB + delta;
        if (size <= 0) continue;
        assertPlanIsSpecCompliant(size);
      }
    }
  });
});

describe("uploadVideoChunks — Content-Range / chunk-order correctness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetchCapturingRequests() {
    const calls: Array<{ url: string; headers: Record<string, string>; bodySize: number }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const body = init.body as Blob;
      calls.push({ url, headers, bodySize: body.size });
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { calls, fetchMock };
  }

  it.each([
    ["4MB", 4 * MB],
    ["exactly 5MB", 5 * MB],
    ["5MB + 1 byte", 5 * MB + 1],
    ["exactly 64MB", 64 * MB],
    ["65MB", 65 * MB],
  ] as const)("sends exactly one correctly-shaped request set for a %s file", async (_label, size) => {
    const { calls } = mockFetchCapturingRequests();
    const plan = planChunks(size);
    const file = Buffer.alloc(size, 1);

    await uploadVideoChunks("https://upload.example/put", file, plan);

    expect(calls).toHaveLength(plan.totalChunkCount);

    let expectedStart = 0;
    calls.forEach((call, i) => {
      expect(call.url).toBe("https://upload.example/put");
      expect(call.headers["Content-Type"]).toBe("video/mp4");

      const isLast = i === plan.totalChunkCount - 1;
      const expectedEnd = isLast ? size - 1 : expectedStart + plan.chunkSize - 1;
      expect(call.headers["Content-Range"]).toBe(`bytes ${expectedStart}-${expectedEnd}/${size}`);
      expect(call.headers["Content-Length"]).toBe(String(expectedEnd - expectedStart + 1));
      expect(call.bodySize).toBe(expectedEnd - expectedStart + 1);

      expectedStart = expectedEnd + 1;
    });
    expect(expectedStart).toBe(size);
  });

  it("uploads chunks sequentially, not concurrently (TikTok requires in-order delivery)", async () => {
    const order: number[] = [];
    let inFlight = 0;
    const fetchMock = vi.fn(async () => {
      inFlight++;
      expect(inFlight).toBe(1); // fails if a second chunk starts before the first resolves
      order.push(inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const size = 25 * MB; // -> 3 chunks at ~8.3MB each
    const plan = planChunks(size);
    expect(plan.totalChunkCount).toBeGreaterThan(1);
    await uploadVideoChunks("https://upload.example/put", Buffer.alloc(size), plan);

    expect(fetchMock).toHaveBeenCalledTimes(plan.totalChunkCount);
  });

  it("throws immediately on a non-2xx chunk response and does not upload further chunks (no resume/retry — see audit doc)", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      if (callCount === 2) {
        return new Response("chunk rejected", { status: 500 });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const size = 30 * MB; // -> multiple chunks
    const plan = planChunks(size);
    expect(plan.totalChunkCount).toBeGreaterThanOrEqual(3);

    await expect(uploadVideoChunks("https://upload.example/put", Buffer.alloc(size), plan)).rejects.toThrow(
      /Chunk 2\/\d+ upload failed \(500\)/
    );
    // Confirms it stopped after the failing chunk instead of continuing.
    expect(callCount).toBe(2);
  });
});
