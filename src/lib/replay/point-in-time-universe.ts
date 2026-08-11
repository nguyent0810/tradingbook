/**
 * Resolve "what was in the scan universe on date T" for a point-in-time replay.
 *
 * The live scanner asks the database for `StockSymbol where active = true`. That
 * is correct for today and wrong for every historical date: `active` is a mutable
 * curation flag with no effective dating, so replaying 2019 with it silently uses
 * the 2026 roster.
 *
 * There is no listing/delisting table to consult, but the bars themselves are a
 * primary record: a symbol that printed a bar in the window ending at T was
 * listed and trading at T. That is the proxy used here — evidence rather than a
 * flag that has since been edited.
 *
 * What this DOES fix:
 *   - symbols that had not listed yet are excluded from earlier sessions
 *   - symbols dormant/halted through the window are excluded
 *   - tactical symbols are bounded by `addedAt <= T < expiresAt`
 *
 * What it CANNOT fix, and must be stated in any result built on it:
 *   - a symbol delisted before today, or curated out of `stock_symbols`, has no
 *     bars in this database at all. It cannot be replayed, so the universe is
 *     still "names that survived to today". Results are survivor-conditional.
 *     Quantify it with `estimateSurvivorshipExposure` rather than assuming it away.
 */

export type SymbolActivityRow = {
  symbolId: string;
  symbol: string;
  /** Bars strictly within the recency window ending at the replay session. */
  barsInWindow: number;
  /** Newest bar on or before the replay session. */
  lastBarDate: string | null;
  /** Oldest bar the database holds for this symbol, at any time. */
  firstBarDateEver: string | null;
};

export type TacticalWindowRow = {
  symbol: string;
  addedAt: string;
  expiresAt: string;
  status: string;
  activeForScanner: boolean;
};

export type PointInTimeUniverseOptions = {
  /**
   * How many calendar days back from the session a symbol must show trading in.
   * Matches the tradability lookback so the universe and the filter agree on
   * what "currently trading" means.
   */
  recencyWindowDays: number;
  /** Minimum bars inside the window before a symbol counts as listed-and-trading. */
  minBarsInWindow: number;
  /**
   * How stale the newest bar may be before the symbol is treated as gone. A
   * symbol whose last print is months old was suspended or delisted by then,
   * whatever its current `active` flag says.
   */
  maxBarStalenessDays: number;
};

export const DEFAULT_PIT_UNIVERSE_OPTIONS: PointInTimeUniverseOptions = {
  recencyWindowDays: 300,
  minBarsInWindow: 120,
  maxBarStalenessDays: 21,
};

export type UniverseMember = {
  symbolId: string;
  symbol: string;
  source: "CORE" | "TACTICAL" | "BOTH";
};

export type PointInTimeUniverse = {
  sessionDate: string;
  members: UniverseMember[];
  excluded: Array<{ symbol: string; reason: string }>;
  stats: {
    candidatesConsidered: number;
    included: number;
    excludedNotListedYet: number;
    excludedTooFewBars: number;
    excludedStale: number;
    tacticalIncluded: number;
  };
};

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Tactical rows in force at `sessionDate`.
 *
 * `status` and `activeForScanner` are current values with no history, so a row
 * revoked later still looks active for past dates. That residual is unavoidable
 * without dated status transitions and is reported, not hidden.
 */
export function tacticalSymbolsAsOf(
  rows: readonly TacticalWindowRow[],
  sessionDate: string
): string[] {
  return [
    ...new Set(
      rows
        .filter(
          (r) =>
            r.status === "ACTIVE" &&
            r.activeForScanner &&
            r.addedAt.slice(0, 10) <= sessionDate &&
            r.expiresAt.slice(0, 10) > sessionDate
        )
        .map((r) => r.symbol.trim().toUpperCase())
    ),
  ].sort();
}

export function resolvePointInTimeUniverse(params: {
  sessionDate: string;
  activity: readonly SymbolActivityRow[];
  tactical: readonly TacticalWindowRow[];
  options?: Partial<PointInTimeUniverseOptions>;
}): PointInTimeUniverse {
  const opts = { ...DEFAULT_PIT_UNIVERSE_OPTIONS, ...(params.options ?? {}) };
  const tacticalSet = new Set(tacticalSymbolsAsOf(params.tactical, params.sessionDate));

  const members: UniverseMember[] = [];
  const excluded: Array<{ symbol: string; reason: string }> = [];
  let notListedYet = 0;
  let tooFewBars = 0;
  let stale = 0;
  let tacticalIncluded = 0;

  for (const a of params.activity) {
    const key = a.symbol.trim().toUpperCase();

    if (a.firstBarDateEver == null || a.firstBarDateEver > params.sessionDate) {
      notListedYet++;
      excluded.push({ symbol: key, reason: "not_listed_yet" });
      continue;
    }
    if (a.lastBarDate == null) {
      notListedYet++;
      excluded.push({ symbol: key, reason: "no_bars_through_session" });
      continue;
    }
    if (daysBetween(a.lastBarDate, params.sessionDate) > opts.maxBarStalenessDays) {
      stale++;
      excluded.push({ symbol: key, reason: `stale_last_bar_${a.lastBarDate}` });
      continue;
    }
    if (a.barsInWindow < opts.minBarsInWindow) {
      tooFewBars++;
      excluded.push({ symbol: key, reason: `only_${a.barsInWindow}_bars_in_window` });
      continue;
    }

    const isTactical = tacticalSet.has(key);
    if (isTactical) tacticalIncluded++;
    members.push({ symbolId: a.symbolId, symbol: key, source: isTactical ? "BOTH" : "CORE" });
  }

  members.sort((x, y) => x.symbol.localeCompare(y.symbol));

  return {
    sessionDate: params.sessionDate,
    members,
    excluded,
    stats: {
      candidatesConsidered: params.activity.length,
      included: members.length,
      excludedNotListedYet: notListedYet,
      excludedTooFewBars: tooFewBars,
      excludedStale: stale,
      tacticalIncluded,
    },
  };
}

/**
 * Size the survivorship hole rather than assume it away.
 *
 * Every symbol the database knows about but that carries no bars is a name we
 * cannot replay. If that count is material relative to the replayed universe,
 * every performance number downstream is survivor-conditional and must say so.
 */
export function estimateSurvivorshipExposure(params: {
  totalSymbolsKnown: number;
  symbolsWithAnyBars: number;
  replayedUniverseSize: number;
}): {
  unreplayableSymbols: number;
  unreplayablePct: number;
  verdict: "material" | "minor";
  note: string;
} {
  const unreplayable = Math.max(0, params.totalSymbolsKnown - params.symbolsWithAnyBars);
  const pct =
    params.totalSymbolsKnown === 0 ? 0 : (unreplayable / params.totalSymbolsKnown) * 100;
  const material = pct >= 10;
  return {
    unreplayableSymbols: unreplayable,
    unreplayablePct: Number(pct.toFixed(1)),
    verdict: material ? "material" : "minor",
    note: material
      ? `${unreplayable} of ${params.totalSymbolsKnown} known symbols have no bars and cannot be ` +
        `replayed. Results are survivor-conditional: they describe names that survived to today, ` +
        `not the universe as it was.`
      : `${unreplayable} of ${params.totalSymbolsKnown} known symbols have no bars. Survivorship ` +
        `exposure is small but non-zero.`,
  };
}
