import type { UniverseSymbolRow } from "@/lib/tactical-universe";

export function buildImportSymbolKeys(
  rows: ReadonlyArray<UniverseSymbolRow>,
  options?: { exclude?: (symbol: string) => boolean }
): string[] {
  const exclude = options?.exclude ?? (() => false);
  const deduped = new Set<string>();
  for (const row of rows) {
    const key = row.symbol.trim().toUpperCase();
    if (!key) continue;
    if (exclude(key)) continue;
    deduped.add(key);
  }
  return [...deduped].sort((a, b) => a.localeCompare(b));
}
