import { NextResponse } from "next/server";
import { getTikTokSession, isDirectPostEnabled } from "@/lib/tiktok/auth";

export async function GET() {
  const session = await getTikTokSession();
  return NextResponse.json({
    connected: Boolean(session),
    openId: session?.openId ?? null,
    directPostEnabled: isDirectPostEnabled(),
  });
}
