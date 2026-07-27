import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/tiktok/auth";
import { fetchPublishStatus, TikTokApiError } from "@/lib/tiktok/tiktok";

export async function GET(request: Request) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to TikTok." }, { status: 401 });
  }

  const url = new URL(request.url);
  const publishId = url.searchParams.get("publishId");
  if (!publishId) {
    return NextResponse.json({ error: "Missing publishId." }, { status: 400 });
  }

  try {
    const status = await fetchPublishStatus(accessToken, publishId);
    return NextResponse.json(status);
  } catch (e) {
    if (e instanceof TikTokApiError) {
      return NextResponse.json({ error: `${e.code}: ${e.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Status check failed." }, { status: 500 });
  }
}
