import "../paper-lab-workstation.css";

type StatusKind = "OPEN" | "PARTIAL" | "CLOSED_TP" | "CLOSED_SL" | "EXPIRED" | "INVALIDATED" | string;

const STATUS_CLASS: Record<string, string> = {
  OPEN: "paper-lab-status--open",
  PARTIAL: "paper-lab-status--partial",
  CLOSED_TP: "paper-lab-status--tp",
  CLOSED_SL: "paper-lab-status--sl",
  EXPIRED: "paper-lab-status--expired",
  INVALIDATED: "paper-lab-status--invalid",
};

export function StatusPill({ status }: { status: StatusKind }) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_");
  return (
    <span className={`paper-lab-status-pill ${STATUS_CLASS[normalized] ?? "paper-lab-status--open"}`}>
      {status}
    </span>
  );
}
