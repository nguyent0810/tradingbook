import type { Gate2BarInput } from "@/lib/scanner/gate2/types";

export function bar(
  date: string,
  o: number,
  h: number,
  l: number,
  c: number,
  v: number
): Gate2BarInput {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
  };
}

/** Flat base then reclaim — synthetic for unit tests only. */
export function buildReclaimWinnerSeries(): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  let price = 20;
  for (let i = 0; i < 55; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    const dk = d.toISOString().slice(0, 10);
    const drift = i < 40 ? -0.02 : 0.015;
    price = Math.max(15, price * (1 + drift));
    out.push(
      bar(
        dk,
        price * 0.99,
        price * 1.01,
        price * 0.98,
        price,
        i === 54 ? 2_000_000 : 800_000
      )
    );
  }
  const last = out[out.length - 1]!;
  out[out.length - 1] = bar(
    last.date.toISOString().slice(0, 10),
    16.5,
    17.8,
    16.4,
    17.6,
    2_500_000
  );
  return out;
}

export function buildFailedReclaimSeries(): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  let price = 22;
  for (let i = 0; i < 55; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    const dk = d.toISOString().slice(0, 10);
    price *= i === 54 ? 0.97 : 1.001;
    out.push(bar(dk, price, price * 1.005, price * 0.995, price, 600_000));
  }
  return out;
}

export function buildExtendedLeaderSeries(): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  let price = 18;
  for (let i = 0; i < 55; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    const dk = d.toISOString().slice(0, 10);
    price *= 1.012;
    out.push(bar(dk, price * 0.99, price * 1.02, price * 0.98, price, 1_100_000));
  }
  return out;
}

export function buildWeakVolumeFakeoutSeries(): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  let price = 20;
  for (let i = 0; i < 55; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    const dk = d.toISOString().slice(0, 10);
    price *= 1.002;
    out.push(bar(dk, price, price * 1.01, price * 0.99, price, 500_000));
  }
  const lastDate = out[out.length - 1]!.date.toISOString().slice(0, 10);
  out[out.length - 1] = bar(lastDate, price, price * 1.03, price * 0.99, price * 1.02, 200_000);
  return out;
}

export function flatIndexBars(stockBars: readonly Gate2BarInput[]): Gate2BarInput[] {
  return stockBars.map((b, i) => ({
    date: b.date,
    open: 1200 + i * 0.1,
    high: 1201 + i * 0.1,
    low: 1199 + i * 0.1,
    close: 1200 + i * 0.05,
    volume: 100_000_000,
  }));
}
