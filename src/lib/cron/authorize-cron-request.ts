export type CronAuthFailure =
  | "cron_secret_missing"
  | "missing_authorization"
  | "malformed_bearer"
  | "bearer_mismatch";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string; reason: CronAuthFailure };

export function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  const raw = m?.[1];
  return raw != null ? raw.trim() : null;
}

/** Shared auth for `/api/cron/*` routes (Vercel Cron + manual Bearer). */
export function authorizeCronRequest(
  request: Request,
  secret: string | undefined,
  isVercel: boolean
): CronAuthResult {
  const trimmed = secret?.trim();
  if (isVercel && !trimmed) {
    return {
      ok: false,
      status: 500,
      error:
        "CRON_SECRET is not configured — add CRON_SECRET to Vercel Production env and redeploy.",
      reason: "cron_secret_missing",
    };
  }
  if (!trimmed) {
    return { ok: true };
  }

  const authHeader = request.headers.get("authorization");
  const token = parseBearerToken(authHeader);
  if (!authHeader?.trim()) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "missing_authorization",
    };
  }
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "malformed_bearer",
    };
  }
  if (token !== trimmed) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: "bearer_mismatch",
    };
  }
  return { ok: true };
}
