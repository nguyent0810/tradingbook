import type { OpenPositionRowDto } from "@/lib/paper-lab/types/arena-dto";
import { formatEquityThousandVndPerShare } from "@/lib/formatters";
import { POSITION_GLOSSARY } from "@/lib/paper-lab/ui/arena-copy";
import {
  formatArenaVndCompact,
  formatBoardLotQty,
  formatPctFromEntry,
  formatPctSigned,
} from "@/lib/paper-lab/ui/arena-format";
import { PaperLabHelpIcon } from "./ui/PaperLabHelpIcon";
import { StatusPill } from "./ui/StatusPill";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function HeaderCell({
  label,
  className,
}: {
  label: keyof typeof POSITION_GLOSSARY | string;
  className?: string;
}) {
  const tip = POSITION_GLOSSARY[label as keyof typeof POSITION_GLOSSARY];
  return (
    <th className={className}>
      {label}
      {tip ? <PaperLabHelpIcon text={tip} /> : null}
    </th>
  );
}

function PriceWithPct({
  entry,
  value,
}: {
  entry: number;
  value: number;
}) {
  const pct = formatPctFromEntry(entry, value);
  return (
    <div className="tabular-nums">
      <div>{formatEquityThousandVndPerShare(value)}</div>
      {pct && <div className="text-[0.65rem] text-slate-500">{pct}</div>}
    </div>
  );
}

export function OpenPositionsTable({ positions }: { positions: OpenPositionRowDto[] }) {
  if (positions.length === 0) {
    return (
      <PaperLabPanel title="Open Positions" testId="paper-lab-positions">
        <p className="text-sm text-slate-400">No open positions.</p>
      </PaperLabPanel>
    );
  }

  return (
    <PaperLabPanel title="Open Positions" testId="paper-lab-positions">
      <div className="safe-table-wrap positions-table-wrapper">
        <table className="paper-lab-table paper-lab-table--positions positions-table safe-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Symbol</th>
              <HeaderCell label="Entry" />
              <HeaderCell label="Stop" />
              <HeaderCell label="TP" />
              <HeaderCell label="Qty (Lot)" />
              <HeaderCell label="Alloc %" className="paper-lab-col-alloc" />
              <HeaderCell label="Risk" className="paper-lab-col-risk" />
              <HeaderCell label="UPNL" className="paper-lab-col-upnl" />
              <HeaderCell label="UPNL %" className="paper-lab-col-upnl" />
              <HeaderCell label="R" />
              <HeaderCell label="Days" />
              <HeaderCell label="Status" />
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const lot = formatBoardLotQty(p.quantity);
              const pnlClass = p.unrealizedPnlVnd >= 0 ? "paper-lab-positive" : "paper-lab-negative";
              return (
                <tr key={p.id}>
                  <td className="paper-lab-agent-col">
                    <span className="paper-lab-truncate block">{p.agentName}</span>
                  </td>
                  <td className="font-mono">{p.symbol}</td>
                  <td className="tabular-nums">{formatEquityThousandVndPerShare(p.entryPriceKVnd)}</td>
                  <td><PriceWithPct entry={p.entryPriceKVnd} value={p.stopLossKVnd} /></td>
                  <td><PriceWithPct entry={p.entryPriceKVnd} value={p.takeProfitKVnd} /></td>
                  <td className="tabular-nums" title={lot.isRounded ? "Quantity not on 100-share board lot" : undefined}>
                    {lot.display}
                  </td>
                  <td className="tabular-nums paper-lab-col-alloc">{p.allocationPct.toFixed(1)}%</td>
                  <td className="tabular-nums paper-lab-col-risk">{formatArenaVndCompact(p.riskAmountVnd)}</td>
                  <td className={`tabular-nums paper-lab-col-upnl ${pnlClass}`}>
                    {formatArenaVndCompact(p.unrealizedPnlVnd)}
                  </td>
                  <td className={`tabular-nums paper-lab-col-upnl ${pnlClass}`}>
                    {formatPctSigned(p.unrealizedPnlPct)}
                  </td>
                  <td className={`tabular-nums ${p.rMultiple >= 0 ? "paper-lab-positive" : "paper-lab-negative"}`}>
                    {p.rMultiple.toFixed(1)}R
                  </td>
                  <td className="tabular-nums">{p.holdingDays}</td>
                  <td><StatusPill status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="paper-lab-table-glossary mt-2 text-xs text-slate-500">
        <strong className="text-slate-400">Legend:</strong>{" "}
        <StatusPill status="OPEN" /> active ·{" "}
        <StatusPill status="PARTIAL" /> partially filled · Qty shown in 100-share board lots (VN market).
      </footer>
    </PaperLabPanel>
  );
}
