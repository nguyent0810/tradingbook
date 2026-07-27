import { NextResponse } from "next/server";
import { clearTikTokSession } from "@/lib/tiktok/auth";

export async function POST() {
  await clearTikTokSession();
  return NextResponse.json({ ok: true });
}
