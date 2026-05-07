import { normalizeTacticalSymbolInput } from "@/lib/tactical-universe";

export type AddTacticalCliOptions = {
  source: string;
  expiresDays: number;
  note: string | null;
  createMissing: boolean;
};

export function parseFlagValue(
  argv: readonly string[],
  name: string
): string | null {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) return null;
  const v = hit.slice(name.length + 1).trim();
  return v.length > 0 ? v : null;
}

export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

export function normalizeUniqueSymbols(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const n = normalizeTacticalSymbolInput(s);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function resolveExpiresDays(raw: string | null): number {
  if (!raw) return 14;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 365) {
    throw new Error("--expires-days must be an integer between 1 and 365.");
  }
  return n;
}

export function computeExpiry(now: Date, expiresDays: number): Date {
  const ms = expiresDays * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms);
}

export function parseAddTacticalCliOptions(
  argv: readonly string[]
): AddTacticalCliOptions {
  const source = parseFlagValue(argv, "--source") ?? "manual";
  const expiresDays = resolveExpiresDays(parseFlagValue(argv, "--expires-days"));
  const note = parseFlagValue(argv, "--note");
  const createMissing = hasFlag(argv, "--create-missing");
  return { source, expiresDays, note, createMissing };
}
