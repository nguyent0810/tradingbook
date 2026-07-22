import type { OpenPositionRowDto } from "@/lib/paper-lab/types/arena-dto";
import { formatEquityThousandVndPerShare } from "@/lib/formatters";
import { POSITION_GLOSSARY } from "@/lib/paper-lab/ui/arena-copy";
import { formatBoardLotQty, formatPctFromEntry } from "@/lib/paper-lab/ui/arena-format";
import { PaperLabHelpIcon } from "./ui/PaperLabHelpIcon";
import { StatusPill } from "./ui/StatusPill";
import { PaperLabPanel } from "./ui/PaperLabPanel";
import "./paper-lab-workstation.css";
import "./paper-lab-command-center.css";

function HeaderCell({
  label,
  glossaryKey,
}: {
  label: string;
  glossaryKey?: keyof typeof POSITION_GLOSSARY;
}) {
  const tip = glossaryKey ? POSITION_GLOSSARY[glossaryKey] : undefined;
  return (
    <th>
      {label}
      {tip ? <PaperLabHelpIcon text={tip} /> : null}
    </th>
  );
}

function PriceWithPct({
  entry,
  value,
  tone,
}: {
  entry: number;
  value: number;
  tone: "stop" | "tp";
}) {
  const pct = formatPctFromEntry(entry, value);
  const pctClass = tone === "stop" ? "paper-lab-negative" : "paper-lab-positive";
  return (
    <div className="paper-lab-tabular">
      <div>{formatEquityThousandVndPerShare(value)}</div>
      {pct && <div className={`text-[0.7rem] ${pctClass}`}>{pct}</div>}
    </div>
  );
}

function isFlatR(position: OpenPositionRowDto): boolean {
  return Math.abs(position.rMultiple) < 0.05 && Math.abs(position.unrealizedPnlVnd) < 1;
}

function RMultipleCell({ position }: { position: OpenPositionRowDto }) {
  const flat = isFlatR(position);
  const { rMultiple } = position;
  let dotClass = "paper-lab-rr-badge__dot--mid";
  if (flat) dotClass = "paper-lab-rr-badge__dot--flat";
  else if (rMultiple >= 2) dotClass = "paper-lab-rr-badge__dot--strong";
  else if (rMultiple < 0) dotClass = "paper-lab-rr-badge__dot--weak";

  return (
    <div className="paper-lab-r-cell">
      <span className={`paper-lab-rr-badge ${flat ? "paper-lab-rr-badge--flat" : ""}`}>
        <span className={`paper-lab-rr-badge__dot ${dotClass}`} aria-hidden />
        {rMultiple.toFixed(1)}R
      </span>
      {flat && <span className="paper-lab-r-flat-hint">Đi ngang / chưa có tiến triển</span>}
    </div>
  );
}

function PositionsTable({ positions }: { positions: OpenPositionRowDto[] }) {
  if (positions.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)]">Không có vị thế đang mở.</p>;
  }

  return (
    <>
      <div className="safe-table-wrap positions-table-wrapper positions-table-wrapper--full">
        <table
          className="paper-lab-table paper-lab-table--positions positions-table positions-table--full safe-table"
          data-testid="paper-lab-positions"
        >
          <thead>
            <tr>
              <th>Agent</th>
              <th>Mã</th>
              <HeaderCell label="Vào lệnh" glossaryKey="Entry" />
              <HeaderCell label="Cắt lỗ" glossaryKey="Stop" />
              <HeaderCell label="TP" glossaryKey="TP" />
              <HeaderCell label="KL (Lô)" glossaryKey="Qty (Lot)" />
              <HeaderCell label="Tỷ trọng %" glossaryKey="Alloc %" />
              <HeaderCell label="R" glossaryKey="R" />
              <HeaderCell label="Ngày" glossaryKey="Days" />
              <HeaderCell label="Trạng thái" glossaryKey="Status" />
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const lot = formatBoardLotQty(p.quantity);
              return (
                <tr key={p.id}>
                  <td className="paper-lab-agent-col">
                    <span className="paper-lab-truncate block">{p.agentName}</span>
                  </td>
                  <td className="font-mono">{p.symbol}</td>
                  <td className="paper-lab-tabular">{formatEquityThousandVndPerShare(p.entryPriceKVnd)}</td>
                  <td>
                    <PriceWithPct entry={p.entryPriceKVnd} value={p.stopLossKVnd} tone="stop" />
                  </td>
                  <td>
                    <PriceWithPct entry={p.entryPriceKVnd} value={p.takeProfitKVnd} tone="tp" />
                  </td>
                  <td title={lot.isRounded ? "Khối lượng không tròn lô 100 cổ phiếu" : undefined}>
                    <div className="paper-lab-qty-cell__primary">{lot.sharesLabel}</div>
                    <div className="paper-lab-qty-cell__sub">{lot.lots} lô</div>
                  </td>
                  <td className="paper-lab-tabular">{p.allocationPct.toFixed(1)}%</td>
                  <td className={isFlatR(p) ? "" : p.rMultiple >= 0 ? "paper-lab-positive" : "paper-lab-negative"}>
                    <RMultipleCell position={p} />
                  </td>
                  <td className="paper-lab-tabular">{p.holdingDays}</td>
                  <td><StatusPill status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="paper-lab-table-glossary paper-lab-table-glossary--subtle mt-2">
        <StatusPill status="OPEN" /> đang mở · <StatusPill status="PARTIAL" /> một phần · KL tính theo lô 100 cổ phiếu
      </footer>
    </>
  );
}

export function OpenPositionsTable({
  positions,
  embedded = false,
}: {
  positions: OpenPositionRowDto[];
  embedded?: boolean;
}) {
  if (embedded) {
    return <PositionsTable positions={positions} />;
  }

  if (positions.length === 0) {
    return (
      <PaperLabPanel title="Vị thế đang mở" testId="paper-lab-positions" tone="elevated">
        <p className="text-sm text-[var(--text-tertiary)]">Không có vị thế đang mở.</p>
      </PaperLabPanel>
    );
  }

  return (
    <PaperLabPanel title="Vị thế đang mở" testId="paper-lab-positions" tone="elevated">
      <PositionsTable positions={positions} />
    </PaperLabPanel>
  );
}
