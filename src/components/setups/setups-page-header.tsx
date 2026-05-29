import Link from "next/link";
import { V3PageHeader } from "@/components/trading-os-v3/shared/v3-page-header";

export function SetupsPageHeader() {
  return (
    <V3PageHeader
      kicker="Setup pipeline"
      title="Setups workstation"
      lead="Qualified setups, near-miss queue, and rejection intelligence from the latest scan."
      testId="setups-page-header"
      actions={
        <Link href="/dashboard" className="tosv3-btn tosv3-btn--secondary">
          Command deck
        </Link>
      }
    />
  );
}
