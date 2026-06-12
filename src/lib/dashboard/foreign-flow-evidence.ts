/** Product threshold: foreign 1D outflow below this triggers danger state (VND). */
export const FOREIGN_FLOW_DANGER_VND = -200_000_000_000;

export function foreignFlowEvidenceState(
  netVnd: number | null | undefined
): "ok" | "warn" | "danger" {
  if (netVnd == null || !Number.isFinite(netVnd)) return "ok";
  if (netVnd <= FOREIGN_FLOW_DANGER_VND) return "danger";
  if (netVnd < 0) return "warn";
  return "ok";
}
