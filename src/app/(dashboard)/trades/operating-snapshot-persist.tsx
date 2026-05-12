"use client";

import { useEffect } from "react";
import { persistBookOperatingSnapshot } from "@/app/actions/operating-snapshot";
import type { BookOperatingSnapshotV2 } from "@/lib/trades/operating-trend-discipline";

export function OperatingSnapshotPersist({
  snapshot,
}: {
  snapshot: BookOperatingSnapshotV2 | null;
}) {
  useEffect(() => {
    if (!snapshot) return;
    void persistBookOperatingSnapshot(snapshot);
  }, [snapshot]);

  return null;
}
