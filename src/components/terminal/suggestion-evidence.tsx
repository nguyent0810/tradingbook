import type { EvidenceStatus } from "@/lib/terminal/trade-suggestion-display";

/**
 * "GỢI Ý THAM KHẢO · Chưa kiểm chứng (N/100)" kèm liên kết ADR 0001 — cùng một
 * dòng trên mọi màn hiện gợi ý lệnh (ADR 0003). Đặt bên trong khối chữ của màn.
 */
export function SuggestionEvidence({ evidence }: { evidence: EvidenceStatus }) {
  return (
    <>
      GỢI Ý THAM KHẢO ·{" "}
      <a href={evidence.href} target="_blank" rel="noreferrer" style={{ color: "var(--tm-accent)" }}>
        {evidence.label}
      </a>
    </>
  );
}
