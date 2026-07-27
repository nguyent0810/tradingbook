import { NextResponse } from "next/server";
import { consumeOAuthState, exchangeCodeForToken, setTikTokSession } from "@/lib/tiktok/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const demoUrl = new URL("/tiktok-demo", url.origin);

  if (oauthError) {
    demoUrl.searchParams.set("error", oauthError);
    return NextResponse.redirect(demoUrl);
  }

  const stateOk = await consumeOAuthState(state);
  if (!stateOk || !code) {
    demoUrl.searchParams.set("error", "invalid_state_or_code");
    return NextResponse.redirect(demoUrl);
  }

  try {
    const token = await exchangeCodeForToken(code);
    await setTikTokSession(token);
    demoUrl.searchParams.set("connected", "1");
  } catch (e) {
    demoUrl.searchParams.set("error", e instanceof Error ? e.message : "token_exchange_failed");
  }

  return NextResponse.redirect(demoUrl);
}
