import Link from "next/link";
import { SetupsCandidatesMasterDetail } from "@/components/setups/setups-candidates-master-detail";
import { RadarSweepEmpty } from "./RadarSweepEmpty";
import type { CandidateScannerProps } from "./types";
import "./setups-workstation.css";

export function CandidateScanner({
  candidates,
  emptyReason,
  partialBanner,
}: CandidateScannerProps) {
  return (
    <>
      {partialBanner}

      {candidates.length === 0 ? (
        <section className="sw-glass-panel p-6" data-testid="setups-candidates-panel">
          <header className="mb-6">
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
              Surfaced candidates
            </p>
            <h2 className="mt-1 text-base font-medium text-slate-200">
              Qualified setups — core scanner Tier A/B only
            </h2>
          </header>

          <div
            className="flex flex-col items-center gap-6 py-8 text-center"
            data-testid="setups-candidates-empty"
          >
            <RadarSweepEmpty />
            <div className="max-w-md space-y-2">
              <p className="text-sm font-medium text-slate-300">No surfaced candidates on this scan</p>
              {emptyReason ? (
                <p className="text-sm leading-relaxed text-slate-400">{emptyReason}</p>
              ) : null}
            </div>
            <Link
              href="/dashboard"
              className="rounded-md border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 font-mono text-xs uppercase tracking-wide text-indigo-300 transition hover:bg-indigo-500/20"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>
      ) : (
        <section className="sw-glass-panel p-4" data-testid="setups-candidates-panel">
          <header className="mb-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
              Surfaced candidates
            </p>
            <h2 className="mt-1 text-base font-medium text-slate-200">
              Surfaced candidates ({candidates.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Qualified setups — core scanner Tier A/B only
            </p>
          </header>
          <SetupsCandidatesMasterDetail candidates={candidates} />
        </section>
      )}
    </>
  );
}
