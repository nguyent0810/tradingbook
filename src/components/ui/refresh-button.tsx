"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Re-runs the current route's server data fetch — a recovery action for
 *  server-rendered error banners that aren't inside an error.tsx boundary
 *  (so there's no `reset()` to call). */
export function RefreshButton({ label = "Retry" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);

  return (
    <button
      type="button"
      className="tosv3-btn tosv3-btn--secondary"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => {
        setClicked(true);
        startTransition(() => router.refresh());
      }}
    >
      {isPending && clicked ? "Retrying…" : label}
    </button>
  );
}
