import "server-only";

import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { V3Collapsible, V3Panel } from "@/components/trading-os-v3/layout";

export async function SetupsMomentumDeckAsync() {
  return (
    <V3Collapsible
      summary="Bối cảnh động lượng mở rộng — kiểm tra breakout mới"
      testId="setups-momentum-deck"
      className="tosv3-setups-momentum"
    >
      <V3Panel className="tosv3-setups-momentum__panel" glass={false}>
        <MomentumWatchSection embedded />
      </V3Panel>
    </V3Collapsible>
  );
}
