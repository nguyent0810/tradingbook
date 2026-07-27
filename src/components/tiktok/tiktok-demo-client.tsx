"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type MeResponse = { connected: boolean; openId: string | null; directPostEnabled: boolean };
type UploadResponse = { publishId: string; mode: "inbox_draft" | "direct_post" } | { error: string };
type StatusResponse =
  | { status: string; fail_reason?: string }
  | { error: string };

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

export function TikTokDemoClient() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [me, setMe] = useState<MeResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [directPost, setDirectPost] = useState(false);
  const [title, setTitle] = useState("TradeLog TikTok demo upload");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/tiktok/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ connected: false, openId: null, directPostEnabled: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  async function handleUpload() {
    if (!file) return;
    setPhase("uploading");
    setMessage(null);

    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("directPost", String(directPost));

    let json: UploadResponse;
    try {
      const res = await fetch("/api/tiktok/upload", { method: "POST", body: form });
      json = await res.json();
    } catch {
      setPhase("error");
      setMessage("Network error while uploading.");
      return;
    }

    if ("error" in json) {
      setPhase("error");
      setMessage(json.error);
      return;
    }

    setPhase("processing");
    const publishId = json.publishId;
    const startedAt = Date.now();

    pollTimer.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setPhase("error");
        setMessage("Timed out waiting for TikTok to finish processing.");
        return;
      }

      let statusJson: StatusResponse;
      try {
        const statusRes = await fetch(`/api/tiktok/status?publishId=${encodeURIComponent(publishId)}`);
        statusJson = await statusRes.json();
      } catch {
        return; // transient network blip — keep polling until timeout
      }
      if ("error" in statusJson) return; // transient TikTok-side error — keep polling until timeout

      if (statusJson.status === "FAILED") {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setPhase("error");
        setMessage(`TikTok reported a failure: ${statusJson.fail_reason ?? "unknown reason"}`);
      } else if (statusJson.status === "SEND_TO_USER_INBOX" || statusJson.status === "PUBLISH_COMPLETE") {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setPhase("done");
        setMessage(
          statusJson.status === "PUBLISH_COMPLETE"
            ? "Published — check the TikTok app to view it."
            : "Sent to your TikTok inbox as a draft — open the TikTok app to review and post it."
        );
      }
    }, POLL_INTERVAL_MS);
  }

  if (!me) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  if (!me.connected) {
    return (
      <div className="space-y-3">
        {oauthError ? <p className="text-sm text-red-400">TikTok login failed: {oauthError}</p> : null}
        <a
          href="/api/tiktok/oauth/start"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Login with TikTok
        </a>
      </div>
    );
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Connected (open_id: <span className="font-mono">{me.openId}</span>){"  "}
        <button
          type="button"
          onClick={() => fetch("/api/tiktok/logout", { method: "POST" }).then(() => window.location.reload())}
          className="ml-2 underline"
        >
          Log out
        </button>
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium">MP4 video</label>
        <input type="file" accept="video/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      {me.directPostEnabled ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={directPost} onChange={(e) => setDirectPost(e.target.checked)} />
            Direct Post (publish, instead of sending to Inbox as a draft)
          </label>
          {directPost ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Caption"
              className="w-full rounded border border-gray-700 bg-transparent px-3 py-1.5 text-sm"
            />
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!file || busy}
        onClick={handleUpload}
        className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
      >
        {phase === "uploading" ? "Uploading…" : phase === "processing" ? "Processing…" : "Upload"}
      </button>

      {message ? (
        <p className={`text-sm ${phase === "error" ? "text-red-400" : "text-green-400"}`}>{message}</p>
      ) : null}
    </div>
  );
}
