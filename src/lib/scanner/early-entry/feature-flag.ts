/** Production-off unless `EARLY_ENTRY_V1_ENABLED` is `true` or `1`. */
export function isEarlyEntryV1Enabled(): boolean {
  const v = process.env.EARLY_ENTRY_V1_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
