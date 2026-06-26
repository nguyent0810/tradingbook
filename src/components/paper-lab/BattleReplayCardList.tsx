import type { BattleReplayRowDto } from "@/lib/paper-lab/types/arena-dto";
import { formatConfidencePct } from "@/lib/paper-lab/ui/arena-format";
import { ActionBadge } from "./ui/ActionBadge";
import { PaperLabDetailsDialog } from "./ui/PaperLabDetailsDialog";
import { StatusPill } from "./ui/StatusPill";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "WIN") return <StatusPill status="CLOSED_TP" />;
  if (outcome === "LOSS") return <StatusPill status="CLOSED_SL" />;
  if (outcome === "OPEN") return <StatusPill status="OPEN" />;
  return <span className="text-slate-500 text-xs">{outcome}</span>;
}

function BulletList({
  items,
  className,
}: {
  items: string[];
  className: string;
}) {
  if (items.length === 0) return <span className="text-xs text-slate-500">—</span>;
  return (
    <ul className={`text-xs list-disc list-inside space-y-0.5 ${className}`}>
      {items.slice(0, 2).map((s) => (
        <li key={s} className="line-clamp-2">
          {s}
        </li>
      ))}
    </ul>
  );
}

export function BattleReplayCardList({ rows }: { rows: BattleReplayRowDto[] }) {
  return (
    <ul className="paper-lab-battle-cards space-y-3" data-testid="paper-lab-battle-cards">
      {rows.map((row) => (
        <li key={row.agentId} className="paper-lab-battle-card">
          <div className="paper-lab-battle-card__header">
            <div className="min-w-0 flex-1">
              <div className="paper-lab-cell-strong truncate">{row.agentName}</div>
              <span className="paper-lab-agent-tile__style">{row.style}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <ActionBadge action={row.action} />
              <span className="text-xs paper-lab-tabular text-slate-300">
                {formatConfidencePct(row.confidence)}
              </span>
              <OutcomeBadge outcome={row.outcome} />
            </div>
          </div>

          <p className="line-clamp-2 text-xs text-slate-300 mt-2 mb-2">
            <span className="text-slate-500">Summary: </span>
            {row.explanation.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <div className="paper-lab-label mb-1">Supports</div>
              <BulletList items={row.explanation.supporting} className="text-emerald-300/85" />
            </div>
            <div>
              <div className="paper-lab-label mb-1">Concerns</div>
              <BulletList items={row.explanation.opposing} className="text-amber-200/85" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/30">
            <p className="text-xs text-slate-400 line-clamp-1 flex-1 min-w-0">
              <span className="text-slate-500">Style lens: </span>
              {row.explanation.styleLens}
            </p>
            <PaperLabDetailsDialog
              title={`${row.agentName} — battle details`}
              testId={`battle-details-${row.agentId}`}
              triggerLabel="View details"
            >
              <p className="text-sm text-slate-200 mb-3">{row.explanation.summary}</p>
              <div className="mb-3">
                <div className="text-xs font-semibold text-emerald-300/90 mb-1">Supports</div>
                <ul className="text-xs text-emerald-300/85 list-disc list-inside space-y-1">
                  {row.explanation.supporting.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="mb-3">
                <div className="text-xs font-semibold text-amber-200/90 mb-1">Concerns</div>
                <ul className="text-xs text-amber-200/85 list-disc list-inside space-y-1">
                  {row.explanation.opposing.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-slate-400">
                <span className="text-slate-500">Style lens: </span>
                {row.explanation.styleLens}
              </p>
            </PaperLabDetailsDialog>
          </div>
        </li>
      ))}
    </ul>
  );
}
