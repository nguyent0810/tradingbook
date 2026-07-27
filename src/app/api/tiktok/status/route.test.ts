import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ getValidAccessToken: vi.fn<() => Promise<string | null>>() }));
const tiktokMock = vi.hoisted(() => ({
  fetchPublishStatus: vi.fn(),
  TikTokApiError: class TikTokApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "TikTokApiError";
      this.code = code;
    }
  },
}));

vi.mock("@/lib/tiktok/auth", () => authMock);
vi.mock("@/lib/tiktok/tiktok", () => tiktokMock);

const { GET } = await import("./route");

afterEach(() => {
  vi.clearAllMocks();
});

function statusRequest(publishId?: string) {
  const url = new URL("http://localhost/api/tiktok/status");
  if (publishId !== undefined) url.searchParams.set("publishId", publishId);
  return new Request(url);
}

describe("GET /api/tiktok/status", () => {
  it("returns 401 when there is no valid TikTok session", async () => {
    authMock.getValidAccessToken.mockResolvedValue(null);
    const res = await GET(statusRequest("p-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when publishId is missing", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    const res = await GET(statusRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/publishId/i);
  });

  it("passes the access token and publishId straight through to fetchPublishStatus and returns its result verbatim", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token-xyz");
    tiktokMock.fetchPublishStatus.mockResolvedValue({ status: "PROCESSING_UPLOAD" });
    const res = await GET(statusRequest("publish-42"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "PROCESSING_UPLOAD" });
    expect(tiktokMock.fetchPublishStatus).toHaveBeenCalledWith("token-xyz", "publish-42");
  });

  it("maps FAILED-status-fetch API errors (e.g. auth revoked mid-poll) to 502", async () => {
    authMock.getValidAccessToken.mockResolvedValue("token");
    tiktokMock.fetchPublishStatus.mockRejectedValue(new tiktokMock.TikTokApiError("auth_removed", "Authorization was revoked"));
    const res = await GET(statusRequest("p-1"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("auth_removed: Authorization was revoked");
  });
});
