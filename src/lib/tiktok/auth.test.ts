import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Scoped to this file only (unlike a global vitest.config.ts resolve.conditions
// change, which was tried and reverted — it broke react-dom's own
// "react-server" conditional export used by unrelated component tests).
vi.mock("server-only", () => ({}));

type SetOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: number;
};
type CookieRecord = { value: string; options: SetOptions };

let cookieStore: Map<string, CookieRecord>;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const record = cookieStore.get(name);
      return record ? { name, value: record.value } : undefined;
    },
    set: (name: string, value: string, options: SetOptions) => {
      cookieStore.set(name, { value, options });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

beforeEach(() => {
  cookieStore = new Map();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function loadAuth() {
  return import("./auth");
}

describe("buildAuthorizeUrl — exact match against developers.tiktok.com/doc/login-kit-web/", () => {
  it("includes exactly the five required query params with the correct values", async () => {
    vi.stubEnv("TIKTOK_CLIENT_KEY", "ck_test");
    vi.stubEnv("TIKTOK_REDIRECT_URI", "https://example.com/api/tiktok/oauth/callback");
    const { buildAuthorizeUrl } = await loadAuth();

    const url = new URL(buildAuthorizeUrl("state-123"));
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe("ck_test");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/api/tiktok/oauth/callback");
    expect(url.searchParams.get("state")).toBe("state-123");
    // Comma-separated per docs, not space- or plus-separated.
    expect(url.searchParams.get("scope")).toBe("user.info.basic,video.upload");
    // No PKCE params — confirmed not required for the web flow.
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.has("code_challenge_method")).toBe(false);
  });

  it("throws a clear error instead of silently sending an empty client_key when TIKTOK_CLIENT_KEY is unset", async () => {
    vi.stubEnv("TIKTOK_CLIENT_KEY", "");
    const { buildAuthorizeUrl } = await loadAuth();
    expect(() => buildAuthorizeUrl("s")).toThrow(/TIKTOK_CLIENT_KEY/);
  });
});

describe("tiktokScopes — minimum-scope requirement", () => {
  it("requests only user.info.basic,video.upload by default (no video.publish)", async () => {
    vi.stubEnv("TIKTOK_ENABLE_DIRECT_POST", "");
    const { tiktokScopes, isDirectPostEnabled } = await loadAuth();
    expect(tiktokScopes()).toBe("user.info.basic,video.upload");
    expect(isDirectPostEnabled()).toBe(false);
  });

  it("adds video.publish only when TIKTOK_ENABLE_DIRECT_POST=true", async () => {
    vi.stubEnv("TIKTOK_ENABLE_DIRECT_POST", "true");
    const { tiktokScopes, isDirectPostEnabled } = await loadAuth();
    expect(tiktokScopes()).toBe("user.info.basic,video.upload,video.publish");
    expect(isDirectPostEnabled()).toBe(true);
  });
});

describe("token exchange / refresh — request shape", () => {
  function mockTokenEndpoint(body: unknown, status = 200) {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify(body), { status })
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("exchangeCodeForToken POSTs form-encoded grant_type=authorization_code to the exact token endpoint", async () => {
    vi.stubEnv("TIKTOK_CLIENT_KEY", "ck");
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "cs");
    vi.stubEnv("TIKTOK_REDIRECT_URI", "https://example.com/cb");
    const fetchMock = mockTokenEndpoint({
      access_token: "at",
      expires_in: 86400,
      open_id: "oid",
      refresh_token: "rt",
      refresh_expires_in: 31536000,
      scope: "user.info.basic,video.upload",
      token_type: "Bearer",
    });
    const { exchangeCodeForToken } = await loadAuth();

    const token = await exchangeCodeForToken("auth-code-1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://open.tiktokapis.com/v2/oauth/token/");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const params = new URLSearchParams(init.body as string);
    expect(params.get("client_key")).toBe("ck");
    expect(params.get("client_secret")).toBe("cs");
    expect(params.get("code")).toBe("auth-code-1");
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("redirect_uri")).toBe("https://example.com/cb");
    expect(token.access_token).toBe("at");
    expect(token.refresh_token).toBe("rt");
  });

  it("refreshAccessToken POSTs grant_type=refresh_token (not authorization_code) with no `code` field", async () => {
    vi.stubEnv("TIKTOK_CLIENT_KEY", "ck");
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "cs");
    const fetchMock = mockTokenEndpoint({
      access_token: "at2",
      expires_in: 86400,
      open_id: "oid",
      refresh_token: "rt2",
      refresh_expires_in: 31536000,
      scope: "user.info.basic,video.upload",
      token_type: "Bearer",
    });
    const { refreshAccessToken } = await loadAuth();

    const token = await refreshAccessToken("old-refresh-token");

    const [, init] = fetchMock.mock.calls[0]!;
    const params = new URLSearchParams(init.body as string);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("old-refresh-token");
    expect(params.has("code")).toBe(false);
    // Per TikTok's docs, a refresh can rotate the refresh_token — the new
    // value must be what gets persisted, not the one that was submitted.
    expect(token.refresh_token).toBe("rt2");
  });

  it("throws with TikTok's real error_description on a rejected exchange (matches the live 'Authorization code is expired' response captured in the audit)", async () => {
    vi.stubEnv("TIKTOK_CLIENT_KEY", "ck");
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "cs");
    mockTokenEndpoint({ error: "invalid_grant", error_description: "Authorization code is expired." }, 400);
    const { exchangeCodeForToken } = await loadAuth();

    await expect(exchangeCodeForToken("expired-code")).rejects.toThrow(/Authorization code is expired/);
  });
});

describe("session cookie — security attributes and round trip", () => {
  it("setTikTokSession writes an httpOnly, SameSite=lax, path=/ cookie; secure only in production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { setTikTokSession, getTikTokSession } = await loadAuth();

    await setTikTokSession({
      access_token: "at",
      expires_in: 86400,
      open_id: "oid-1",
      refresh_token: "rt",
      refresh_expires_in: 31536000,
      scope: "user.info.basic,video.upload",
      token_type: "Bearer",
    });

    const record = cookieStore.get("tiktok_session")!;
    expect(record).toBeDefined();
    expect(record.options.httpOnly).toBe(true);
    expect(record.options.sameSite).toBe("lax");
    expect(record.options.path).toBe("/");
    expect(record.options.secure).toBe(false); // development — matches the live curl capture in the audit

    // The stored value must be opaque (encrypted), not the raw session JSON.
    expect(record.value).not.toContain("oid-1");
    expect(record.value.split(".")).toHaveLength(3); // JWS compact form

    const session = await getTikTokSession();
    expect(session?.openId).toBe("oid-1");
    expect(session?.accessToken).toBe("at");
  });

  it("sets secure:true when NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { setTikTokSession } = await loadAuth();
    await setTikTokSession({
      access_token: "at",
      expires_in: 86400,
      open_id: "oid",
      refresh_token: "rt",
      refresh_expires_in: 1,
      scope: "s",
      token_type: "Bearer",
    });
    expect(cookieStore.get("tiktok_session")!.options.secure).toBe(true);
  });

  it("getTikTokSession returns null when no cookie is present, and clearTikTokSession removes it", async () => {
    const { getTikTokSession, setTikTokSession, clearTikTokSession } = await loadAuth();
    expect(await getTikTokSession()).toBeNull();

    await setTikTokSession({
      access_token: "at",
      expires_in: 86400,
      open_id: "oid",
      refresh_token: "rt",
      refresh_expires_in: 1,
      scope: "s",
      token_type: "Bearer",
    });
    expect(await getTikTokSession()).not.toBeNull();

    await clearTikTokSession();
    expect(cookieStore.has("tiktok_session")).toBe(false);
    expect(await getTikTokSession()).toBeNull();
  });

  it("getTikTokSession returns null for a tampered/undecryptable cookie value instead of throwing", async () => {
    const { getTikTokSession } = await loadAuth();
    cookieStore.set("tiktok_session", { value: "not-a-real-jwt", options: {} });
    await expect(getTikTokSession()).resolves.toBeNull();
  });
});

describe("getValidAccessToken — expiry-based refresh trigger", () => {
  it("returns the current access token without refreshing when comfortably valid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { setTikTokSession, getValidAccessToken } = await loadAuth();

    await setTikTokSession({
      access_token: "still-valid",
      expires_in: 3600, // 1 hour — well outside the 5-minute refresh margin
      open_id: "oid",
      refresh_token: "rt",
      refresh_expires_in: 1,
      scope: "s",
      token_type: "Bearer",
    });

    const token = await getValidAccessToken();
    expect(token).toBe("still-valid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes and re-persists when within the 5-minute expiry margin", async () => {
    vi.stubEnv("TIKTOK_CLIENT_KEY", "ck");
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "cs");
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "refreshed-token",
            expires_in: 86400,
            open_id: "oid",
            refresh_token: "new-refresh-token",
            refresh_expires_in: 31536000,
            scope: "s",
            token_type: "Bearer",
          }),
          { status: 200 }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { setTikTokSession, getValidAccessToken, getTikTokSession } = await loadAuth();

    await setTikTokSession({
      access_token: "about-to-expire",
      expires_in: 60, // 1 minute — inside the 5-minute refresh margin
      open_id: "oid",
      refresh_token: "old-refresh-token",
      refresh_expires_in: 1,
      scope: "s",
      token_type: "Bearer",
    });

    const token = await getValidAccessToken();
    expect(token).toBe("refreshed-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, refreshInit] = fetchMock.mock.calls[0]!;
    const params = new URLSearchParams(refreshInit.body as string);
    expect(params.get("refresh_token")).toBe("old-refresh-token");

    // Re-persisted: a subsequent read reflects the refreshed token, not the old one.
    const persisted = await getTikTokSession();
    expect(persisted?.accessToken).toBe("refreshed-token");
    expect(persisted?.refreshToken).toBe("new-refresh-token");
  });

  it("returns null when there is no session at all, without attempting a refresh", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getValidAccessToken } = await loadAuth();
    expect(await getValidAccessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("OAuth CSRF state — single-use, matches the live replay test in the audit", () => {
  it("createOAuthState sets an httpOnly, SameSite=lax cookie with a 10-minute maxAge", async () => {
    const { createOAuthState } = await loadAuth();
    const state = await createOAuthState();
    expect(state).toMatch(/^[a-f0-9]{32}$/);
    const record = cookieStore.get("tiktok_oauth_state")!;
    expect(record.value).toBe(state);
    expect(record.options.httpOnly).toBe(true);
    expect(record.options.sameSite).toBe("lax");
    expect(record.options.maxAge).toBe(600);
  });

  it("consumeOAuthState accepts a matching state exactly once, then rejects the replay", async () => {
    const { createOAuthState, consumeOAuthState } = await loadAuth();
    const state = await createOAuthState();

    expect(await consumeOAuthState(state)).toBe(true);
    // The cookie must be gone after first use — a second submission with the
    // same value (a captured/replayed callback URL) must fail.
    expect(cookieStore.has("tiktok_oauth_state")).toBe(false);
    expect(await consumeOAuthState(state)).toBe(false);
  });

  it("rejects a mismatched state and a missing state", async () => {
    const { createOAuthState, consumeOAuthState } = await loadAuth();
    await createOAuthState();
    expect(await consumeOAuthState("forged-value")).toBe(false);
    expect(await consumeOAuthState(null)).toBe(false);
  });

  it("rejects when no state cookie was ever set (no oauth/start call preceded this callback)", async () => {
    const { consumeOAuthState } = await loadAuth();
    expect(await consumeOAuthState("anything")).toBe(false);
  });
});
