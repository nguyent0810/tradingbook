import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TikTokApiError,
  fetchPublishStatus,
  initDirectPost,
  initInboxUpload,
  queryCreatorInfo,
} from "./tiktok";

/**
 * Every URL/field-name assertion below is cross-checked directly against
 * developers.tiktok.com/doc/content-posting-api-reference-* (re-fetched at
 * audit time — see docs/integration/TIKTOK_API_AUDIT.md §2 for citations),
 * not against this file's own prior assumptions.
 */

function mockFetchJson(status: number, body: unknown) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("queryCreatorInfo", () => {
  it("POSTs to the exact documented endpoint with a Bearer token and an empty body", async () => {
    const fetchMock = mockFetchJson(200, {
      data: {
        creator_avatar_url: "https://example/avatar.png",
        creator_username: "demo",
        creator_nickname: "Demo",
        privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"],
        comment_disabled: false,
        duet_disabled: false,
        stitch_disabled: false,
        max_video_post_duration_sec: 60,
      },
      error: { code: "ok", message: "", log_id: "abc" },
    });

    const info = await queryCreatorInfo("token-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://open.tiktokapis.com/v2/post/publish/creator_info/query/");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
    expect((init.headers as Record<string, string>)["Content-Type"]).toContain("application/json");
    expect(JSON.parse(init.body as string)).toEqual({});
    expect(info.privacy_level_options).toEqual(["SELF_ONLY", "PUBLIC_TO_EVERYONE"]);
    expect(info.max_video_post_duration_sec).toBe(60);
  });
});

describe("initInboxUpload", () => {
  it("POSTs to the inbox/draft endpoint with only source_info (no post_info)", async () => {
    const fetchMock = mockFetchJson(200, {
      data: { publish_id: "p-1", upload_url: "https://upload.example/1" },
      error: { code: "ok", message: "", log_id: "x" },
    });

    const result = await initInboxUpload("token-123", {
      videoSize: 12_000_000,
      chunkSize: 12_000_000,
      totalChunkCount: 1,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: 12_000_000,
        chunk_size: 12_000_000,
        total_chunk_count: 1,
      },
    });
    expect(body.post_info).toBeUndefined();
    expect(result).toEqual({ publish_id: "p-1", upload_url: "https://upload.example/1" });
  });
});

describe("initDirectPost", () => {
  it("POSTs to the direct-post endpoint with the documented post_info + source_info field names", async () => {
    const fetchMock = mockFetchJson(200, {
      data: { publish_id: "p-2", upload_url: "https://upload.example/2" },
      error: { code: "ok", message: "", log_id: "x" },
    });

    await initDirectPost(
      "token-123",
      { title: "Demo caption", privacyLevel: "SELF_ONLY" },
      { videoSize: 20_000_000, chunkSize: 10_000_000, totalChunkCount: 2 }
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://open.tiktokapis.com/v2/post/publish/video/init/");
    const body = JSON.parse(init.body as string);
    // Exact field names per the reference doc: privacy_level (required),
    // title (optional), disable_duet/comment/stitch (optional booleans).
    expect(body.post_info).toEqual({
      title: "Demo caption",
      privacy_level: "SELF_ONLY",
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    });
    expect(body.source_info).toEqual({
      source: "FILE_UPLOAD",
      video_size: 20_000_000,
      chunk_size: 10_000_000,
      total_chunk_count: 2,
    });
  });
});

describe("fetchPublishStatus", () => {
  it("POSTs {publish_id} to the exact status endpoint and returns TikTok's literal field names verbatim", async () => {
    // Deliberately using TikTok's own misspelling — see the field comment in tiktok.ts.
    mockFetchJson(200, {
      data: {
        status: "PUBLISH_COMPLETE",
        publicaly_available_post_id: ["7000000000000000000"],
        uploaded_bytes: 12_000_000,
        downloaded_bytes: 12_000_000,
      },
      error: { code: "ok", message: "", log_id: "x" },
    });

    const status = await fetchPublishStatus("token-123", "publish-id-1");
    expect(status.status).toBe("PUBLISH_COMPLETE");
    expect(status.publicaly_available_post_id).toEqual(["7000000000000000000"]);
  });

  it("sends the publish_id in the request body under the documented field name", async () => {
    const fetchMock = mockFetchJson(200, {
      data: { status: "PROCESSING_UPLOAD" },
      error: { code: "ok", message: "", log_id: "x" },
    });
    await fetchPublishStatus("token-123", "publish-id-42");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://open.tiktokapis.com/v2/post/publish/status/fetch/");
    expect(JSON.parse(init.body as string)).toEqual({ publish_id: "publish-id-42" });
  });
});

describe("TikTokApiError surfacing — every documented error code", () => {
  const documentedErrorCases: Array<[string, string]> = [
    ["access_token_invalid", "Invalid or missing access token"],
    ["scope_not_authorized", "User did not authorize the required scope"],
    ["scope_permission_missed", "Access token lacks the necessary scope"],
    ["rate_limit_exceeded", "API rate limit exceeded"],
    ["invalid_params", "One or more request fields invalid"],
    ["invalid_file_upload", "Uploaded file does not meet specifications"],
    ["internal_error", "TikTok internal server error"],
    // Content-Posting-specific, confirmed on the direct-post reference doc.
    ["unaudited_client_can_only_post_to_private_accounts", "Unaudited apps may only post privately"],
  ];

  it.each(documentedErrorCases)("propagates code=%s as a TikTokApiError with that exact code", async (code, message) => {
    mockFetchJson(200, { data: {}, error: { code, message, log_id: "log-1" } });

    await expect(queryCreatorInfo("token-123")).rejects.toMatchObject({
      name: "TikTokApiError",
      code,
      message,
      logId: "log-1",
    });
    await expect(queryCreatorInfo("token-123")).rejects.toBeInstanceOf(TikTokApiError);
  });

  it("treats a non-2xx HTTP status with no error envelope as a failure too", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 500 }))
    );
    await expect(fetchPublishStatus("token-123", "p-1")).rejects.toThrow(TikTokApiError);
  });

  it("does not throw when error.code is the literal string \"ok\"", async () => {
    mockFetchJson(200, { data: { status: "PUBLISH_COMPLETE" }, error: { code: "ok", message: "", log_id: "x" } });
    await expect(fetchPublishStatus("token-123", "p-1")).resolves.toBeTruthy();
  });
});
