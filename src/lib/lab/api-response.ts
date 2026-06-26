import { NextResponse } from "next/server";

export const LAB_API_SCHEMA_VERSION = "2.0.0";

export function labJson<T extends Record<string, unknown>>(
  data: T,
  sessionDate?: string | null,
  status = 200
) {
  return NextResponse.json(
    {
      schemaVersion: LAB_API_SCHEMA_VERSION,
      sessionDate: sessionDate ?? null,
      disclaimer: "PAPER_TRADING_ONLY" as const,
      ...data,
    },
    { status }
  );
}

export function labError(message: string, status = 500) {
  return labJson({ ok: false, error: message }, null, status);
}
