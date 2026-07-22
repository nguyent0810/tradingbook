import "server-only";

import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { RefreshButton } from "@/components/ui/refresh-button";
import { V3Panel } from "@/components/trading-os-v3/layout";
import { loadSetupsBaseData } from "./setups-cached-data";

/** No-scan and load-error banners only — main pipeline UI lives in sidebar + candidates. */
export async function SetupsOverviewAsync() {
  const base = await loadSetupsBaseData();

  if (base.latest) return null;

  const dbBanner =
    [base.scanLoadError, base.sessionLoadError, base.equityMaxLoadError]
      .filter(Boolean)
      .join(" ") || null;

  return (
    <div className="tosv3-setups-overview-fallback space-y-4" data-testid="setups-overview-no-run-section">
      {dbBanner ? (
        <ErrorStateWithEvidence
          title="Dữ liệu bộ quét không đầy đủ"
          message={dbBanner}
          evidence="src/app/(dashboard)/setups/setups-overview-async.tsx · loadSetupsBaseData"
          data-testid="setups-overview-db-banner-no-run"
        >
          <RefreshButton />
        </ErrorStateWithEvidence>
      ) : null}
      <V3Panel className="tosv3-empty-state-wrap">
        <EmptyStateWithReason
          title="Chưa có lần quét nào"
          reason="Chưa có lần quét hằng ngày nào trong dữ liệu. Trên production dùng workflow GitHub Actions “Production bar import” (import + quét); ở local chạy npx tsx scripts/run-daily-scanner.ts sau khi đã import dữ liệu giá."
          data-testid="setups-overview-no-scan-run"
        />
      </V3Panel>
    </div>
  );
}
