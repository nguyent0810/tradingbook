import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";

const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

const SESSION_COOKIE = "tiktok_session";
const STATE_COOKIE = "tiktok_oauth_state";

const secretKey =
  process.env.TIKTOK_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-secret-change-in-production";
const encodedKey = new TextEncoder().encode(secretKey);

const DIRECT_POST_ENABLED = process.env.TIKTOK_ENABLE_DIRECT_POST === "true";

/** 5 minutes of headroom before the access token's real expiry. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type TikTokTokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
};

export type TikTokSession = {
  accessToken: string;
  refreshToken: string;
  openId: string;
  scope: string;
  /** Epoch ms. */
  expiresAt: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function clientKey(): string {
  return requiredEnv("TIKTOK_CLIENT_KEY");
}

function clientSecret(): string {
  return requiredEnv("TIKTOK_CLIENT_SECRET");
}

function redirectUri(): string {
  return (
    process.env.TIKTOK_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/tiktok/oauth/callback`
  );
}

export function isDirectPostEnabled(): boolean {
  return DIRECT_POST_ENABLED;
}

/** Minimum scopes for the Content Posting API: `video.publish` (Direct Post)
 *  is only requested when the feature flag is on, so an unaudited/demo app
 *  never asks for a scope it doesn't use. */
export function tiktokScopes(): string {
  const scopes = ["user.info.basic", "video.upload"];
  if (DIRECT_POST_ENABLED) scopes.push("video.publish");
  return scopes.join(",");
}

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set("client_key", clientKey());
  url.searchParams.set("scope", tiktokScopes());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestToken(body: Record<string, string>): Promise<TikTokTokenResponse> {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const detail = json.error_description ?? json.error ?? res.statusText;
    throw new Error(`TikTok token request failed: ${detail}`);
  }
  return json as TikTokTokenResponse;
}

export function exchangeCodeForToken(code: string): Promise<TikTokTokenResponse> {
  return requestToken({
    client_key: clientKey(),
    client_secret: clientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TikTokTokenResponse> {
  return requestToken({
    client_key: clientKey(),
    client_secret: clientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

async function encryptSession(session: TikTokSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60d") // outlives the access token — refresh handles renewal
    .sign(encodedKey);
}

async function decryptSession(value: string | undefined): Promise<TikTokSession | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, encodedKey, { algorithms: ["HS256"] });
    return payload as unknown as TikTokSession;
  } catch {
    return null;
  }
}

/** Persists TikTok's tokens server-side in an encrypted, httpOnly cookie —
 *  entirely separate from the trading app's own `session` cookie/user table. */
export async function setTikTokSession(token: TikTokTokenResponse): Promise<void> {
  const session: TikTokSession = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    openId: token.open_id,
    scope: token.scope,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await encryptSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 24 * 60 * 60,
  });
}

export async function getTikTokSession(): Promise<TikTokSession | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function clearTikTokSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** Returns a valid access token, transparently refreshing (and re-persisting)
 *  when within 5 minutes of expiry. Returns null when there is no session. */
export async function getValidAccessToken(): Promise<string | null> {
  const session = await getTikTokSession();
  if (!session) return null;
  if (Date.now() < session.expiresAt - REFRESH_MARGIN_MS) {
    return session.accessToken;
  }
  const refreshed = await refreshAccessToken(session.refreshToken);
  await setTikTokSession(refreshed);
  return refreshed.access_token;
}

/** CSRF `state` for the OAuth round trip — short-lived, independent of the
 *  long-lived token session above. */
export async function createOAuthState(): Promise<string> {
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return state;
}

export async function consumeOAuthState(receivedState: string | null): Promise<boolean> {
  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  return Boolean(expected) && Boolean(receivedState) && expected === receivedState;
}
