import type { CioPanelDto } from "@/lib/paper-lab/types/arena-dto";
import { CONSENSUS_TOOLTIP } from "@/lib/paper-lab/ui/arena-copy";
import { formatConfidencePct } from "@/lib/paper-lab/ui/arena-format";
import { ActionBadge } from "./ui/ActionBadge";
import { PaperLabDetailsDialog } from "./ui/PaperLabDetailsDialog";
import { PaperLabHelpIcon } from "./ui/PaperLabHelpIcon";
import "./paper-lab-workstation.css";

function VoteSplit({ votes }: { votes: CioPanelDto["recommendations"][0]["actionVotes"] }) {
  const parts = [
    votes.buy > 0 && `BUY ${votes.buy}`,
    votes.hold > 0 && `HOLD ${votes.hold}`,
    votes.sell > 0 && `SELL ${votes.sell}`,
    votes.reduce > 0 && `REDUCE ${votes.reduce}`,
    votes.exit > 0 && `EXIT ${votes.exit}`,
  ].filter(Boolean);
  return <span>{parts.join(" · ") || "No votes"}</span>;
}

export function CioRecommendationPanel({ cio }: { cio: CioPanelDto }) {
  if (cio.recommendations.length === 0) {
    return (
      <section className="paper-lab-cio-panel" data-testid="paper-lab-cio">
        <h3 className="text-sm font-semibold text-cyan-300 mb-2">CIO Final Recommendation</h3>
        <p className="text-sm text-slate-400">No CIO recommendation for this session yet.</p>
      </section>
    );
  }

  return (
    <section className="paper-lab-cio-panel" data-testid="paper-lab-cio">
      <h3 className="text-sm font-semibold text-cyan-300 mb-3">
        CIO Final Recommendation — {cio.sessionDate}
      </h3>
      <ul className="space-y-4">
        {cio.recommendations.map((rec) => (
          <li key={rec.symbol} className="paper-lab-cio-card">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono font-semibold text-slate-100 text-base">{rec.symbol}</span>
              <ActionBadge action={rec.finalAction} />
              <span className="text-xs text-slate-300 tabular-nums">
                {formatConfidencePct(rec.confidence)} confidence
              </span>
            </div>

            <div className="paper-lab-cio-meta">
              <span>
                Consensus:{" "}
                <strong className="text-slate-200">{rec.consensusLabel}</strong>{" "}
                ({rec.consensusScoreDisplay})
                <PaperLabHelpIcon text={CONSENSUS_TOOLTIP} />
              </span>
              <span>
                Vote split: <VoteSplit votes={rec.actionVotes} />
              </span>
            </div>

            <div className="paper-lab-cio-meta mb-2">
              <span>Regime: {rec.regimeContext}</span>
            </div>

            <p className="text-sm text-slate-200 mb-2 paper-lab-line-clamp-3">{rec.decisionSummary}</p>

            {rec.supportingReasons.length > 0 && (
              <div className="paper-lab-cio-section">
                <div className="text-xs font-semibold text-emerald-300/90 mb-1">
                  Why CIO chose {rec.finalAction}
                </div>
                <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
                  {rec.supportingReasons.map((r) => (
                    <li key={r} className="paper-lab-line-clamp-2">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {rec.risks.length > 0 && (
              <div className="paper-lab-cio-section">
                <div className="text-xs font-semibold text-amber-200/90 mb-1">Main risks</div>
                <ul className="text-xs text-amber-100/80 space-y-0.5 list-disc list-inside">
                  {rec.risks.map((r) => (
                    <li key={r} className="paper-lab-line-clamp-2">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {rec.dissentingAgents.length > 0 && (
              <div className="paper-lab-cio-section">
                <div className="text-xs font-semibold text-slate-400 mb-1">Dissent</div>
                <ul className="text-xs text-slate-400 space-y-2">
                  {rec.dissentingAgents.map((d) => (
                    <li key={d.agentId}>
                      <span className="text-slate-300">{d.agentName}</span>{" "}
                      <ActionBadge action={d.action} /> —{" "}
                      <span className="paper-lab-line-clamp-2 block">{d.humanReason}</span>
                    </li>
                  ))}
                </ul>
                {rec.dissentingAgents.some((d) => d.humanReason.length > 80) && (
                  <div className="mt-2">
                    <PaperLabDetailsDialog title={`${rec.symbol} — dissenting agents`}>
                      <ul className="text-sm text-slate-300 space-y-3">
                        {rec.dissentingAgents.map((d) => (
                          <li key={d.agentId}>
                            <span className="font-semibold text-slate-100">{d.agentName}</span>{" "}
                            <ActionBadge action={d.action} />
                            <p className="mt-1 text-slate-400">{d.humanReason}</p>
                          </li>
                        ))}
                      </ul>
                    </PaperLabDetailsDialog>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
