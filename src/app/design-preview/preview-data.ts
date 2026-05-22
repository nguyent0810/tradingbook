import type { OrderBookLevel } from "@/components/ui/order-book";
import type { WatchlistRow } from "@/components/ui/watchlist-table";

export const PREVIEW_WATCHLIST: WatchlistRow[] = [
  {
    symbol: "FPT",
    price: "128.50",
    change: "2.4%",
    direction: "up",
    status: "Ready",
    health: "Healthy",
    actionHint: "Eligible for execution workflow.",
  },
  {
    symbol: "VNM",
    price: "62.10",
    change: "-0.8%",
    direction: "down",
    status: "Watching",
    health: "Warning",
    actionHint: "Wait for pullback into entry zone.",
  },
  {
    symbol: "MWG",
    price: "71.20",
    change: "0.0%",
    direction: "flat",
    status: "New",
    health: "—",
    actionHint: "Monitor for first valid retest.",
  },
];

export const PREVIEW_BIDS: OrderBookLevel[] = [
  { price: "128.40", size: "12.5K", total: "12.5K" },
  { price: "128.30", size: "8.2K", total: "20.7K" },
  { price: "128.20", size: "15.1K", total: "35.8K" },
];

export const PREVIEW_ASKS: OrderBookLevel[] = [
  { price: "128.60", size: "9.4K", total: "9.4K" },
  { price: "128.70", size: "11.0K", total: "20.4K" },
  { price: "128.80", size: "6.8K", total: "27.2K" },
];

export const PREVIEW_MARKET_CARDS = [
  { symbol: "VNINDEX", name: "VN Index", price: "1,284.2", change: "0.62%", direction: "up" as const, badge: "Risk-on" },
  { symbol: "FPT", name: "FPT Corp", price: "128.50", change: "2.41%", direction: "up" as const, badge: "Tier A" },
  { symbol: "HPG", name: "Hoa Phat", price: "27.15", change: "-1.12%", direction: "down" as const, badge: "Watch" },
];
