import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getValidAccessToken: vi.fn<() => Promise<string | null>>(),
  isDirectPostEnabled: vi.fn<() => boolean>(),
}));
const tiktokMock = vi.hoisted(() => ({
  queryCreatorInfo: vi.fn(),
  initInboxUpload: vi.fn(),
  initDirectPost: vi.fn(),
  TikTokApiError: class TikTokApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "TikTokApiError";
      this.code = code;
    }
  },
}));
const uploadMock = vi.hoisted(() => ({
  planChunks: vi.fn(),
  uploadVideoChunks: vi.fn(),
}));

vi.mock("@/lib/tiktok/auth", () => authMock);
vi.mock("@/lib/tiktok/tiktok", () => tiktokMock);
vi.mock("@/lib/tiktok/upload", () => uploadMock);

const { POST } = await import("./route");

function makeUploadRequest(fields: { file?: File; title?: string; directPost?: string }) {
  const form = new FormData();
  if (fields.file) form.set("file", fields.file);
  if (fields.title !== undefined) form.set("title", fields.title);
  if (fields.directPost !== undefined) form.set("directPost", fields.directPost);
  return new Request("http://localhost/api/tiktok/upload", { method: "POST", body: form });
}

function mp4File(bytes = 10, name = "clip.mp4") {
  return new File([new Uint8Array(bytes)], name, { type: "video/mp4" });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/tiktok/upload — auth + input validation", () => {
  it("returns 401 when there is no valid TikTok session, without touching formData", async () => {
    authMock.getValidAccessToken.mockResolvedValue(null);
    const res = await POST(makeUploadRequest({ file: mp4File() }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/log in/i);
  });

  it("returns 400 when no file is provided", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    const res = await POST(makeUploadRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no video file/i);
  });

  it("returns 400 for a non-mp4 file", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    const file = new File([new Uint8Array(10)], "clip.mov", { type: "video/quicktime" });
    const res = await POST(makeUploadRequest({ file }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/only \.mp4/i);
  });

  it("returns 400 for a file over the demo's size cap, without reading its bytes into an upload attempt", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    const oversized = new File([new Uint8Array(201 * 1024 * 1024)], "big.mp4", { type: "video/mp4" });
    const res = await POST(makeUploadRequest({ file: oversized }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too large/i);
    expect(uploadMock.planChunks).not.toHaveBeenCalled();
  });
});

describe("POST /api/tiktok/upload — success paths never leak upload_url to the client", () => {
  it("inbox/draft mode: response is exactly {publishId, mode} — no upload_url field", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    authMock.isDirectPostEnabled.mockReturnValue(false);
    uploadMock.planChunks.mockReturnValue({ videoSize: 10, chunkSize: 10, totalChunkCount: 1 });
    tiktokMock.initInboxUpload.mockResolvedValue({
      publish_id: "p-inbox",
      upload_url: "https://upload.example/secret-put-target",
    });
    uploadMock.uploadVideoChunks.mockResolvedValue(undefined);

    const res = await POST(makeUploadRequest({ file: mp4File(), directPost: "false" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ publishId: "p-inbox", mode: "inbox_draft" });
    expect(JSON.stringify(json)).not.toContain("upload_url");
    expect(JSON.stringify(json)).not.toContain("upload.example");
    expect(tiktokMock.queryCreatorInfo).not.toHaveBeenCalled();
  });

  it("direct-post mode: queries creator info first, uses its first privacy option, still no upload_url leak", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    authMock.isDirectPostEnabled.mockReturnValue(true);
    uploadMock.planChunks.mockReturnValue({ videoSize: 10, chunkSize: 10, totalChunkCount: 1 });
    tiktokMock.queryCreatorInfo.mockResolvedValue({ privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"] });
    tiktokMock.initDirectPost.mockResolvedValue({
      publish_id: "p-direct",
      upload_url: "https://upload.example/secret-put-target",
    });
    uploadMock.uploadVideoChunks.mockResolvedValue(undefined);

    const res = await POST(makeUploadRequest({ file: mp4File(), directPost: "true", title: "Hello" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ publishId: "p-direct", mode: "direct_post" });
    expect(JSON.stringify(json)).not.toContain("upload_url");

    expect(tiktokMock.queryCreatorInfo).toHaveBeenCalledWith("token");
    expect(tiktokMock.initDirectPost).toHaveBeenCalledWith(
      "token",
      { title: "Hello", privacyLevel: "SELF_ONLY" },
      { videoSize: 10, chunkSize: 10, totalChunkCount: 1 }
    );
  });

  it("falls back to inbox/draft when directPost=true but the feature flag is off", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    authMock.isDirectPostEnabled.mockReturnValue(false);
    uploadMock.planChunks.mockReturnValue({ videoSize: 10, chunkSize: 10, totalChunkCount: 1 });
    tiktokMock.initInboxUpload.mockResolvedValue({ publish_id: "p-1", upload_url: "https://upload.example/x" });
    uploadMock.uploadVideoChunks.mockResolvedValue(undefined);

    const res = await POST(makeUploadRequest({ file: mp4File(), directPost: "true" }));
    const json = await res.json();
    expect(json.mode).toBe("inbox_draft");
    expect(tiktokMock.initDirectPost).not.toHaveBeenCalled();
  });
});

describe("POST /api/tiktok/upload — error handling", () => {
  it("maps a TikTokApiError from init to HTTP 502 with 'code: message'", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    authMock.isDirectPostEnabled.mockReturnValue(false);
    uploadMock.planChunks.mockReturnValue({ videoSize: 10, chunkSize: 10, totalChunkCount: 1 });
    tiktokMock.initInboxUpload.mockRejectedValue(
      new tiktokMock.TikTokApiError("access_token_invalid", "Invalid or missing access token")
    );

    const res = await POST(makeUploadRequest({ file: mp4File() }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("access_token_invalid: Invalid or missing access token");
  });

  it("maps a plain chunk-upload failure (e.g. network interruption) to HTTP 500 with its message", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    authMock.isDirectPostEnabled.mockReturnValue(false);
    uploadMock.planChunks.mockReturnValue({ videoSize: 10, chunkSize: 10, totalChunkCount: 1 });
    tiktokMock.initInboxUpload.mockResolvedValue({ publish_id: "p-1", upload_url: "https://upload.example/x" });
    uploadMock.uploadVideoChunks.mockRejectedValue(new Error("Chunk 1/1 upload failed (0): network error"));

    const res = await POST(makeUploadRequest({ file: mp4File() }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/network error/);
  });
});
