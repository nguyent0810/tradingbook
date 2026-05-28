import "server-only";

import { MomentumWatchSection } from "@/components/momentum-watch-section";
import { CommandDeckCollapsible } from "@/components/command-deck";

export async function SetupsMomentumDeckAsync() {
  return (
    <CommandDeckCollapsible
      summary="Extended momentum context — fresh breakouts audit"
      testId="setups-momentum-deck"
      className="pipeline-deck__momentum"
    >
      <MomentumWatchSection embedded />
    </CommandDeckCollapsible>
  );
}
