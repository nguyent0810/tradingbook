// Not marked `server-only`: this file holds no secrets — it takes an
// access token as a parameter (always sourced server-side via auth.ts in
// practice). Keeping it plain lets it be unit-tested directly.
const API_BASE = "https://open.tiktokapis.com";

/** Wraps TikTok's `{data, error: {code, message, log_id}}` response envelope. */
export class TikTokApiError extends Error {
  code: string;
  logId?: string;

  constructor(code: string, message: string, logId?: string) {
    super(message);
    this.name = "TikTokApiError";
    this.code = code;
    this.logId = logId;
  }
}

async function postJson<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const errorCode: string | undefined = json?.error?.code;
  if (!res.ok || (errorCode && errorCode !== "ok")) {
    throw new TikTokApiError(
      errorCode ?? String(res.status),
      json?.error?.message ?? `TikTok API request to ${path} failed`,
      json?.error?.log_id
    );
  }
  return json.data as T;
}

export type CreatorInfo = {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
};

/** Required before every Direct Post — privacy options and duration limits
 *  are per-creator and can change between calls. Not needed for Inbox/Draft. */
export function queryCreatorInfo(accessToken: string): Promise<CreatorInfo> {
  return postJson<CreatorInfo>("/v2/post/publish/creator_info/query/", accessToken, {});
}

export type ChunkPlan = {
  videoSize: number;
  chunkSize: number;
  totalChunkCount: number;
};

export type InitUploadResult = {
  publish_id: string;
  upload_url: string;
};

export function initInboxUpload(accessToken: string, plan: ChunkPlan): Promise<InitUploadResult> {
  return postJson<InitUploadResult>("/v2/post/publish/inbox/video/init/", accessToken, {
    source_info: {
      source: "FILE_UPLOAD",
      video_size: plan.videoSize,
      chunk_size: plan.chunkSize,
      total_chunk_count: plan.totalChunkCount,
    },
  });
}

export type DirectPostInfo = {
  title: string;
  privacyLevel: string;
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
};

export function initDirectPost(
  accessToken: string,
  postInfo: DirectPostInfo,
  plan: ChunkPlan
): Promise<InitUploadResult> {
  return postJson<InitUploadResult>("/v2/post/publish/video/init/", accessToken, {
    post_info: {
      title: postInfo.title,
      privacy_level: postInfo.privacyLevel,
      disable_duet: postInfo.disableDuet ?? false,
      disable_comment: postInfo.disableComment ?? false,
      disable_stitch: postInfo.disableStitch ?? false,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: plan.videoSize,
      chunk_size: plan.chunkSize,
      total_chunk_count: plan.totalChunkCount,
    },
  });
}

export type PublishStatus = {
  status:
    | "PROCESSING_UPLOAD"
    | "PROCESSING_DOWNLOAD"
    | "SEND_TO_USER_INBOX"
    | "PUBLISH_COMPLETE"
    | "FAILED";
  fail_reason?: string;
  /** TikTok's literal (misspelled) field name — do not "fix" it, it must
   *  match their response shape exactly. */
  publicaly_available_post_id?: string[];
  uploaded_bytes?: number;
  downloaded_bytes?: number;
};

export function fetchPublishStatus(accessToken: string, publishId: string): Promise<PublishStatus> {
  return postJson<PublishStatus>("/v2/post/publish/status/fetch/", accessToken, {
    publish_id: publishId,
  });
}
