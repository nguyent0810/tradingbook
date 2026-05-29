"use client";

import { RelativeStrengthRadar } from "@/components/trading-os-v3/sections/relative-strength-radar";
import { mapRsWatchlistToV3Panel } from "@/lib/dashboard/v3-user-copy";
import type { RsNearMissWatchlistPanelDto } from "@/lib/scanner/gate2/rs-near-miss-watchlist";

type Props = {
  panel: RsNearMissWatchlistPanelDto;
  testId?: string;
};

export function SetupsRsWatchlistV3({ panel, testId = "setups-rs-near-miss-watchlist" }: Props) {
  const v3Panel = mapRsWatchlistToV3Panel(panel);
  return (
    <div data-testid={testId}>
      <RelativeStrengthRadar panel={v3Panel} />
    </div>
  );
}
