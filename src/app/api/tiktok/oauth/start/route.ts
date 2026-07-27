import { NextResponse } from "next/server";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/tiktok/auth";

export async function GET() {
  const state = await createOAuthState();
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
