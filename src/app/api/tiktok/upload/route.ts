import { NextResponse } from "next/server";
import { getValidAccessToken, isDirectPostEnabled } from "@/lib/tiktok/auth";
import { queryCreatorInfo, initInboxUpload, initDirectPost, TikTokApiError } from "@/lib/tiktok/tiktok";
import { planChunks, uploadVideoChunks } from "@/lib/tiktok/upload";

// Node is the default runtime for route handlers, and this app's
// nextConfig.cacheComponents rejects an explicit `runtime` export outright
// (confirmed live — see docs/integration/TIKTOK_API_AUDIT.md §2) — leave it
// unset rather than declaring "nodejs" explicitly.
export const maxDuration = 60;

// Soft cap for this review-demo flow — well under TikTok's own 4GB limit.
// Your hosting platform's serverless request-body limit may be smaller than
// either number; see docs/integration/TIKTOK_CONTENT_POSTING_DEMO.md.
const MAX_DEMO_FILE_BYTES = 200 * 1024 * 1024;

function isMp4(file: File): boolean {
  return file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
}

export async function POST(request: Request) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to TikTok. Please log in first." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "TradeLog TikTok demo upload").slice(0, 150);
  const wantsDirectPost = form.get("directPost") === "true" && isDirectPostEnabled();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No video file provided." }, { status: 400 });
  }
  if (!isMp4(file)) {
    return NextResponse.json({ error: "Only .mp4 files are supported." }, { status: 400 });
  }
  if (file.size > MAX_DEMO_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large for this demo (max ${MAX_DEMO_FILE_BYTES / 1024 / 1024}MB).` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const plan = planChunks(buffer.byteLength);

  try {
    let publishId: string;
    let uploadUrl: string;

    if (wantsDirectPost) {
      const creatorInfo = await queryCreatorInfo(accessToken);
      const privacyLevel = creatorInfo.privacy_level_options[0] ?? "SELF_ONLY";
      const init = await initDirectPost(accessToken, { title, privacyLevel }, plan);
      publishId = init.publish_id;
      uploadUrl = init.upload_url;
    } else {
      const init = await initInboxUpload(accessToken, plan);
      publishId = init.publish_id;
      uploadUrl = init.upload_url;
    }

    await uploadVideoChunks(uploadUrl, buffer, plan);

    return NextResponse.json({ publishId, mode: wantsDirectPost ? "direct_post" : "inbox_draft" });
  } catch (e) {
    if (e instanceof TikTokApiError) {
      return NextResponse.json({ error: `${e.code}: ${e.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 500 });
  }
}
