/** Shared formatting helpers for Paper Lab Arena UI. */

import { VN_BOARD_LOT_SHARES } from "@/lib/paper-lab/engine/board-lot";

const BOARD_LOT = VN_BOARD_LOT_SHARES;

export function formatArenaVndCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B ₫`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M ₫`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K ₫`;
  return `${sign}${abs.toFixed(0)} ₫`;
}

export function formatPctSigned(n: number, digits = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatShortRef(id: string | null | undefined): string {
  if (!id) return "—";
  const clean = id.replace(/-/g, "");
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-8)}`;
}

export function formatOrderRef(id: string | null | undefined): string {
  if (!id) return "—";
  const clean = id.replace(/-/g, "");
  return `ORD-${clean.slice(-5).toUpperCase()}`;
}

export function formatBoardLotQty(quantity: number): {
  sharesLabel: string;
  lots: number;
  display: string;
  isRounded: boolean;
} {
  const lots = Math.floor(quantity / BOARD_LOT);
  const sharesLabel = new Intl.NumberFormat("en-US").format(quantity);
  const isRounded = quantity % BOARD_LOT !== 0;
  const display = `${sharesLabel} (${lots} lot${lots === 1 ? "" : "s"})`;
  return { sharesLabel, lots, display, isRounded };
}

export function formatPctFromEntry(
  entry: number,
  target: number
): string | null {
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(target)) return null;
  const pct = ((target - entry) / entry) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatConfidencePct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function confidenceBand(confidence: number): "Low" | "Medium" | "High" {
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}

export function consensusLabel(score: number): "Weak" | "Medium" | "Strong" {
  const abs = Math.abs(score);
  if (abs >= 0.5) return "Strong";
  if (abs >= 0.25) return "Medium";
  return "Weak";
}

export function consensusScoreDisplay(score: number): string {
  const normalized = Math.round(Math.abs(score) * 100);
  return `${normalized}/100`;
}
