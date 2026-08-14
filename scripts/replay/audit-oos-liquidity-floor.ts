/**
 * READ-ONLY: §0/§6 probe — does the frozen liquidity floor bite differently in
 * earlier years?
 *
 * `TRADABILITY_MIN_AVG_VALUE_VND_20` is a fixed 2,000,000,000 VND. Vietnamese
 * market turnover grew by more than an order of magnitude over this history, so
 * the same nominal floor selects a very different slice of the market in 2014
 * than in 2025. That matters for a pre-2015 out-of-sample sample twice over: it
 * decides how many setups could exist at all (power), and whether the surviving
 * universe is comparable to the in-sample one (§11 mechanics).
 *
 * Measures, per year: how many distinct symbols ever cleared the 20-session
 * average-value floor, and total market turnover.
 *
 *   npx tsx scripts/replay/audit-oos-liquidity-floor.ts
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import {
  TRADABILITY_MIN_AVG_VALUE_VND_20,
  TRADABILITY_MIN_AVG_VOLUME_20,
  TRADABILITY_MIN_CLOSE_VND,
  TRADABILITY_ROLLING_DAYS,
} from "../../src/lib/scanner/tradability-constants";

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.error(`  ${label}: attempt ${i + 1} failed, retrying`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

async function main(): Promise<void> {
  console.error(`audit-oos-liquidity-floor → ${describeDatabaseUrl()} (read-only)`);
  console.log(
    `floors: value20 >= ${TRADABILITY_MIN_AVG_VALUE_VND_20.toLocaleString()} VND · ` +
      `vol20 >= ${TRADABILITY_MIN_AVG_VOLUME_20.toLocaleString()} · ` +
      `close >= ${TRADABILITY_MIN_CLOSE_VND.toLocaleString()} VND · window ${TRADABILITY_ROLLING_DAYS}`,
  );

  // close is kVND, volume is shares → traded value in VND = close * 1000 * volume.
  const rows = await withRetry("liquidity", () =>
    prisma.$queryRawUnsafe<any[]>(
      `with v as (
         select symbol_id, date,
                avg(close * 1000 * volume) over (
                  partition by symbol_id order by date rows between ${TRADABILITY_ROLLING_DAYS - 1} preceding and current row
                ) as val20,
                avg(volume) over (
                  partition by symbol_id order by date rows between ${TRADABILITY_ROLLING_DAYS - 1} preceding and current row
                ) as vol20,
                close * 1000 as close_vnd,
                close * 1000 * volume as value_vnd,
                count(*) over (partition by symbol_id order by date rows between ${TRADABILITY_ROLLING_DAYS - 1} preceding and current row) as w
         from stock_daily_bars
       )
       select extract(year from date)::int as y,
              count(distinct symbol_id)::int as syms_any,
              count(distinct case when w = ${TRADABILITY_ROLLING_DAYS}
                                   and val20 >= ${TRADABILITY_MIN_AVG_VALUE_VND_20}
                                   and vol20 >= ${TRADABILITY_MIN_AVG_VOLUME_20}
                                   and close_vnd >= ${TRADABILITY_MIN_CLOSE_VND}
                              then symbol_id end)::int as syms_pass,
              round(sum(value_vnd) / 1e9)::bigint as turnover_bn_vnd
       from v group by 1 order by 1`,
    ),
  );

  console.log("\nyear   symbolsWithBars   everClearedFloors    share   turnover(bn VND)");
  for (const r of rows) {
    const share = r.syms_any ? ((100 * r.syms_pass) / r.syms_any).toFixed(1) : "—";
    console.log(
      `${r.y}   ${String(r.syms_any).padStart(15)}   ${String(r.syms_pass).padStart(17)}   ${String(share).padStart(5)}%   ${String(r.turnover_bn_vnd).padStart(16)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
