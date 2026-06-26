import type { CioPanelDto } from "@/lib/paper-lab/types/arena-dto";
import "./paper-lab-workstation.css";

export function CioRecommendationPanel({ cio }: { cio: CioPanelDto }) {
  return (
    <section className="paper-lab-cio-panel" data-testid="paper-lab-cio">
      <h3 className="text-sm font-semibold text-cyan-300 mb-3">
        CIO Final Recommendation — {cio.sessionDate}
      </h3>
      <ul className="space-y-4">
        {cio.recommendations.map((rec) => (
          <li key={rec.symbol} className="border-b border-slate-700/50 pb-3 last:border-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-semibold text-slate-100">{rec.symbol}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300">
                {rec.finalAction}
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                {(rec.confidence * 100).toFixed(0)}% conf
              </span>
            </div>
            <p className="text-sm text-slate-300 mb-2">{rec.reasoning}</p>
            {rec.risks.length > 0 && (
              <p className="text-xs text-amber-200/90">
                Risks: {rec.risks.join(" · ")}
              </p>
            )}
            {rec.dissentingAgents.length > 0 && (
              <ul className="mt-2 text-xs text-slate-400 space-y-1">
                {rec.dissentingAgents.map((d) => (
                  <li key={d.agentId}>
                    <span className="text-slate-500">Dissent ({d.agentId}):</span> {d.reason}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
