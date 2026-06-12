"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardV3ViewModel, FlashDirection, FlashMap } from "../types";

export type { FlashMap };

function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null;
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function compareFlash(
  prev: DashboardV3ViewModel,
  next: DashboardV3ViewModel
): FlashMap {
  const flashes: FlashMap = {};

  const vnPrev = parseNumeric(prev.marketPulse.vnindex ?? undefined);
  const vnNext = parseNumeric(next.marketPulse.vnindex ?? undefined);
  if (vnPrev != null && vnNext != null && vnPrev !== vnNext) {
    flashes["marketPulse.vnindex"] = vnNext > vnPrev ? "up" : "down";
  }

  if (prev.risk.utilizationPercent != null && next.risk.utilizationPercent != null) {
    if (prev.risk.utilizationPercent !== next.risk.utilizationPercent) {
      flashes["risk.utilizationPercent"] =
        next.risk.utilizationPercent > prev.risk.utilizationPercent ? "up" : "down";
    }
  }

  if (prev.risk.openPositions !== next.risk.openPositions) {
    flashes["risk.openPositions"] =
      next.risk.openPositions > prev.risk.openPositions ? "up" : "down";
  }

  return flashes;
}

export function useTradingData(viewModel: DashboardV3ViewModel) {
  const prevRef = useRef(viewModel);
  const [flashMap, setFlashMap] = useState<FlashMap>({});
  const [wirePhase, setWirePhase] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const flashes = compareFlash(prevRef.current, viewModel);
    prevRef.current = viewModel;
    if (Object.keys(flashes).length > 0) {
      setFlashMap(flashes);
      const timer = window.setTimeout(() => setFlashMap({}), 650);
      return () => window.clearTimeout(timer);
    }
  }, [viewModel]);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setBootComplete(true), 1200);
    return () => window.clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      setWirePhase((p) => (p + 0.8) % 100);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { viewModel, flashMap, wirePhase, bootComplete };
}
