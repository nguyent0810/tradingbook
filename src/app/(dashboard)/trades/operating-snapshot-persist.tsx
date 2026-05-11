"use client";

import { useEffect } from "react";
import { persistBookOperatingSnapshot } from "@/app/actions/operating-snapshot";
import type { BookOperatingSnapshotV1 } from "@/lib/trades/operating-trend-discipline";

export function OperatingSnapshotPersist({
  snapshot,
}: {
  snapshot: BookOperatingSnapshotV1 | null;
}) {
  useEffect(() => {
    if (!snapshot) return;
    void persistBookOperatingSnapshot(snapshot);
  }, [snapshot]);

  return null;
}
