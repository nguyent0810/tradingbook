/**
 * Host + database name only (no credentials) for dev logging.
 */
export function describeDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(unset)";
  try {
    const normalized = url
      .replace(/^postgresql:\/\//i, "http://")
      .replace(/^postgres:\/\//i, "http://");
    const u = new URL(normalized);
    const db = u.pathname.replace(/^\//, "").split("?")[0] || "?";
    return `${u.hostname}/${db}`;
  } catch {
    return "(unparseable)";
  }
}
