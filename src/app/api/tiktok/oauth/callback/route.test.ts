import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  consumeOAuthState: vi.fn<(s: string | null) => Promise<boolean>>(),
  exchangeCodeForToken: vi.fn(),
  setTikTokSession: vi.fn(),
}));

vi.mock("@/lib/tiktok/auth", () => authMock);

const { GET } = await import("./route");

afterEach(() => {
  vi.clearAllMocks();
});

function callbackRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/tiktok/oauth/callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

describe("GET /api/tiktok/oauth/callback — CSRF and error-path handling", () => {
  it("redirects straight to an error state when TikTok itself reports an OAuth error, without touching state/code", async () => {
    const res = await GET(callbackRequest({ error: "access_denied" }));
    expect(res.status).toBe(307); // NextResponse.redirect default
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/tiktok-demo");
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(authMock.consumeOAuthState).not.toHaveBeenCalled();
  });

  it("rejects a mismatched/forged state parameter (CSRF protection) even with a valid-looking code", async () => {
    authMock.consumeOAuthState.mockResolvedValue(false);
    const res = await GET(callbackRequest({ code: "real-looking-code", state: "attacker-guessed-state" }));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("error")).toBe("invalid_state_or_code");
    expect(authMock.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(authMock.setTikTokSession).not.toHaveBeenCalled();
  });

  it("rejects a request with a valid state but no code", async () => {
    authMock.consumeOAuthState.mockResolvedValue(true);
    const res = await GET(callbackRequest({ state: "legit-state" }));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("error")).toBe("invalid_state_or_code");
    expect(authMock.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("on valid state + code, exchanges the code, persists the session, and redirects with connected=1", async () => {
    authMock.consumeOAuthState.mockResolvedValue(true);
    authMock.exchangeCodeForToken.mockResolvedValue({ access_token: "at", refresh_token: "rt" });
    const res = await GET(callbackRequest({ state: "legit-state", code: "real-code" }));
    expect(authMock.exchangeCodeForToken).toHaveBeenCalledWith("real-code");
    expect(authMock.setTikTokSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("connected")).toBe("1");
    expect(location.searchParams.get("error")).toBeNull();
  });

  it("surfaces a token-exchange failure (e.g. expired/replayed code) as an error redirect instead of throwing", async () => {
    authMock.consumeOAuthState.mockResolvedValue(true);
    authMock.exchangeCodeForToken.mockRejectedValue(new Error("TikTok token request failed: invalid_grant"));
    const res = await GET(callbackRequest({ state: "legit-state", code: "already-used-code" }));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("error")).toMatch(/invalid_grant/);
    expect(authMock.setTikTokSession).not.toHaveBeenCalled();
  });

  it("a state token can only be consumed once (consumeOAuthState is the single source of truth — replay is its responsibility, verified live in the audit doc)", async () => {
    authMock.consumeOAuthState.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    authMock.exchangeCodeForToken.mockResolvedValue({ access_token: "at" });

    const first = await GET(callbackRequest({ state: "s", code: "c" }));
    expect(new URL(first.headers.get("location")!).searchParams.get("connected")).toBe("1");

    const replay = await GET(callbackRequest({ state: "s", code: "c" }));
    expect(new URL(replay.headers.get("location")!).searchParams.get("error")).toBe("invalid_state_or_code");
  });
});
