"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PanelAnchorId, WireAnchor } from "../types";

export type PanelAnchorRefs = Record<PanelAnchorId, React.RefObject<HTMLDivElement | null>>;

export function usePanelAnchors(containerRef: React.RefObject<HTMLDivElement | null>) {
  const decisionRef = useRef<HTMLDivElement | null>(null);
  const radarRef = useRef<HTMLDivElement | null>(null);
  const riskRef = useRef<HTMLDivElement | null>(null);
  const rsRef = useRef<HTMLDivElement | null>(null);

  const refs = useMemo<PanelAnchorRefs>(
    () => ({
      decision: decisionRef,
      radar: radarRef,
      risk: riskRef,
      rs: rsRef,
    }),
    []
  );

  const [anchors, setAnchors] = useState<WireAnchor[]>([]);
  const [coreCenter, setCoreCenter] = useState<{ x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const next: WireAnchor[] = [];

    const panelIds: PanelAnchorId[] = ["decision", "radar", "risk", "rs"];
    for (const id of panelIds) {
      const el = refs[id].current;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      next.push({
        id,
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
      });
    }

    const coreEl = container.querySelector<HTMLElement>("[data-ccd-core]");
    if (coreEl) {
      const coreRect = coreEl.getBoundingClientRect();
      setCoreCenter({
        x: coreRect.left + coreRect.width / 2 - containerRect.left,
        y: coreRect.top + coreRect.height / 2 - containerRect.top,
      });
    }

    setAnchors(next);
  }, [containerRef, refs]);

  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    for (const id of Object.keys(refs) as PanelAnchorId[]) {
      const el = refs[id].current;
      if (el) observer.observe(el);
    }

    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, measure, refs]);

  return { refs, anchors, coreCenter, remeasure: measure };
}
