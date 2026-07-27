import type { Metadata } from "next";
import { Suspense } from "react";
import { TikTokDemoClient } from "@/components/tiktok/tiktok-demo-client";

export const metadata: Metadata = {
  title: "TikTok Content Posting Demo — TradeLog",
  robots: { index: false, follow: false },
};

export default function TikTokDemoPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">TikTok Content Posting API — Demo</h1>
      <p className="mb-8 text-sm text-gray-400">
        Minimal reference flow for TikTok app review: log in with TikTok, pick a local MP4, upload it.
      </p>
      <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
        <TikTokDemoClient />
      </Suspense>
    </div>
  );
}
