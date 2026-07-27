// Not marked `server-only`: this file holds no secrets and takes only bytes
// + a pre-authorized upload_url, both supplied by the caller (always a
// server-side route handler in practice — see docs/integration/
// TIKTOK_API_AUDIT.md). Keeping it plain lets it be unit-tested directly.
import type { ChunkPlan } from "./tiktok";

const MIN_CHUNK_BYTES = 5 * 1024 * 1024;
const DEFAULT_CHUNK_BYTES = 10 * 1024 * 1024; // comfortably within TikTok's 5-64MB range

/**
 * TikTok's Content Posting API chunking rules: chunks must be 5MB-64MB (the
 * final chunk may run larger, up to 128MB); files <5MB must be sent as a
 * single chunk equal to the whole file size; 1-1000 chunks total.
 *
 * `totalChunkCount` is chosen via ceiling division so the *declared*
 * `chunkSize` (floor(fileSize / totalChunkCount)) never exceeds
 * DEFAULT_CHUNK_BYTES and the final chunk — computed in
 * `uploadVideoChunks` as whatever bytes remain — is always >= chunkSize,
 * never smaller than declared. An earlier floor-based version could pick
 * totalChunkCount=1 with chunkSize fixed at 10MB for files as small as
 * 5MB+1 byte, advertising a chunk_size larger than the single chunk's
 * actual byte count — see docs/integration/TIKTOK_API_AUDIT.md.
 */
export function planChunks(fileSize: number): ChunkPlan {
  if (fileSize <= MIN_CHUNK_BYTES) {
    return { videoSize: fileSize, chunkSize: fileSize, totalChunkCount: 1 };
  }
  const totalChunkCount = Math.max(1, Math.ceil(fileSize / DEFAULT_CHUNK_BYTES));
  const chunkSize = Math.floor(fileSize / totalChunkCount);
  return { videoSize: fileSize, chunkSize, totalChunkCount };
}

/**
 * Sequentially PUTs each chunk to TikTok's `upload_url`, per their required
 * Content-Range contract. Chunks must be uploaded in order — the final chunk
 * absorbs any remainder past `chunkSize * (totalChunkCount - 1)`, which is
 * within TikTok's allowance for an oversized last chunk.
 */
export async function uploadVideoChunks(uploadUrl: string, file: Buffer, plan: ChunkPlan): Promise<void> {
  const { videoSize, chunkSize, totalChunkCount } = plan;

  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    const isLast = i === totalChunkCount - 1;
    const end = isLast ? videoSize - 1 : start + chunkSize - 1;
    const chunk = file.subarray(start, end + 1);
    // A genuine ArrayBuffer copy — Buffer's own `.buffer` is typed as
    // ArrayBufferLike (which admits SharedArrayBuffer), which this project's
    // stricter BlobPart/BodyInit typings reject even though a Buffer works
    // fine as a fetch body at runtime.
    const chunkBytes = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      },
      body: new Blob([chunkBytes]),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Chunk ${i + 1}/${totalChunkCount} upload failed (${res.status}): ${detail}`);
    }
  }
}
