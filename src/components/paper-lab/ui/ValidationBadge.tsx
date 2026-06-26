import "../paper-lab-workstation.css";

export function ValidationBadge({
  status,
}: {
  status: "VALID" | "INVALID" | "SKIPPED";
}) {
  const cls =
    status === "VALID"
      ? "paper-lab-validation-valid"
      : status === "INVALID"
        ? "paper-lab-validation-invalid"
        : "paper-lab-validation-skipped";
  return <span className={`paper-lab-validation-badge ${cls}`}>{status}</span>;
}
