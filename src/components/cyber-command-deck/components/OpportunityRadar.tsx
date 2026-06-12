"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AVOID_PLACEHOLDER_POSITIONS,
  radarActionLabel,
  radarDotSize,
  radarPosition,
} from "@/components/trading-os-v3/v3-radar-utils";
import type { DashboardV3ViewModel, NodeClassification, V3DecisionMode } from "../types";

type Props = {
  radar: DashboardV3ViewModel["radar"];
  decisionMode: V3DecisionMode;
};

type DrawNode = {
  symbol: string;
  x: number;
  y: number;
  radius: number;
  classification: NodeClassification;
  readiness: number;
  risk: number;
  reason: string;
  action: string;
};

function signalTrace(readiness: number, risk: number): number[] {
  const base = Math.max(8, Math.min(92, readiness));
  const caution = Math.max(6, Math.min(34, Math.round(risk / 3)));
  return [
    Math.max(5, base - caution),
    Math.max(5, base - Math.round(caution * 0.6)),
    Math.max(5, base - Math.round(caution * 0.35)),
    Math.max(5, base - Math.round(caution * 0.2)),
    Math.max(5, base),
  ];
}

function classificationFromStatus(
  status: "qualified" | "near-miss"
): NodeClassification {
  return status === "qualified" ? "actionable" : "watch";
}

function nodeColor(classification: NodeClassification): {
  fill: string;
  glow: string;
} {
  switch (classification) {
    case "actionable":
      return { fill: "#00F0FF", glow: "rgba(0, 240, 255, 0.55)" };
    case "watch":
      return { fill: "#F59E0B", glow: "rgba(245, 158, 11, 0.55)" };
    default:
      return { fill: "#EF4444", glow: "rgba(239, 68, 68, 0.6)" };
  }
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const width = 120;
  const height = 24;

  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ccd-radar-tooltip__trace" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function OpportunityRadar({ radar, decisionMode }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<DrawNode[]>([]);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number }>>([]);
  const rafRef = useRef<number | null>(null);
  const [hovered, setHovered] = useState<DrawNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dims, setDims] = useState({ width: 0, height: 320 });

  const buildNodes = useCallback(
    (width: number, height: number): DrawNode[] => {
      const nodes: DrawNode[] = radar.mapDots.map((dot) => {
        const pos = radarPosition(dot);
        const size = radarDotSize(dot);
        return {
          symbol: dot.symbol,
          x: (parseFloat(pos.left) / 100) * width,
          y: (parseFloat(pos.top) / 100) * height,
          radius: size / 2,
          classification: classificationFromStatus(dot.status),
          readiness: dot.readiness,
          risk: dot.risk,
          reason: dot.reason,
          action: radarActionLabel(dot),
        };
      });

      radar.avoidPlaceholders.forEach((placeholder, index) => {
        const pos = AVOID_PLACEHOLDER_POSITIONS[index % AVOID_PLACEHOLDER_POSITIONS.length]!;
        nodes.push({
          symbol: placeholder.symbol,
          x: (parseFloat(pos.left) / 100) * width,
          y: (parseFloat(pos.top) / 100) * height,
          radius: 20,
          classification: "avoid",
          readiness: 0,
          risk: 90,
          reason: placeholder.caption,
          action: "AVOID",
        });
      });

      return nodes;
    },
    [radar]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = rect.width;
    const height = rect.height;

    if (width <= 0 || height <= 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * 0.45;

    for (let ring = 1; ring <= 4; ring++) {
      const r = (maxR / 4) * ring;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.08 + ring * 0.03})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();

    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
      ctx.fill();
    }

    const nodes = buildNodes(width, height);
    nodesRef.current = nodes;

    for (const node of nodes) {
      const { fill, glow } = nodeColor(node.classification);
      const isHovered = hovered?.symbol === node.symbol;

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 4 : 0), 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.globalAlpha = isHovered ? 1 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#0a0d14";
      ctx.font = `bold ${Math.max(9, node.radius * 0.45)}px var(--font-mono, monospace)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.symbol, node.x, node.y);
    }
  }, [buildNodes, hovered]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const updateDims = () => {
      const rect = wrap.getBoundingClientRect();
      setDims({ width: rect.width, height: Math.max(320, rect.height || 320) });
    };

    updateDims();
    const observer = new ResizeObserver(updateDims);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (particlesRef.current.length === 0 && dims.width > 0) {
      particlesRef.current = Array.from({ length: 28 }, () => ({
        x: Math.random() * dims.width,
        y: Math.random() * dims.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }));
    }
  }, [dims.width, dims.height]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      draw();
      return;
    }

    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHovered(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hitTest = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const node of [...nodesRef.current].reverse()) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.hypot(dx, dy) <= node.radius + 6) return node;
    }
    return null;
  };

  const showActionableLegend = decisionMode === "TRADE";

  return (
    <section
      className="ccd-panel ccd-panel-fill p-4 h-full"
      aria-label="Opportunity radar"
      data-testid="dashboard-cyber-radar"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="ccd-kicker">Opportunity Radar</span>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Readiness → · Risk ↓ · Size = priority
          </p>
        </div>
        <ul className="ccd-radar-legend list-none m-0 p-0">
          {showActionableLegend ? (
            <li>
              <i className="ccd-radar-legend__dot ccd-radar-legend__dot--actionable" />
              Actionable
            </li>
          ) : null}
          <li>
            <i className="ccd-radar-legend__dot ccd-radar-legend__dot--watch" />
            Watch
          </li>
          <li>
            <i className="ccd-radar-legend__dot ccd-radar-legend__dot--avoid" />
            Avoid
          </li>
        </ul>
      </div>

      <div
        ref={wrapRef}
        className="ccd-radar-canvas-wrap ccd-radar-canvas-wrap--fill"
        onMouseMove={(e) => {
          const node = hitTest(e.clientX, e.clientY);
          setHovered(node);
          if (node) {
            const rect = wrapRef.current!.getBoundingClientRect();
            setTooltipPos({
              x: e.clientX - rect.left + 12,
              y: e.clientY - rect.top + 12,
            });
          }
        }}
        onMouseLeave={() => setHovered(null)}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          const node = hitTest(touch.clientX, touch.clientY);
          setHovered(node);
          if (node && wrapRef.current) {
            const rect = wrapRef.current.getBoundingClientRect();
            setTooltipPos({
              x: touch.clientX - rect.left + 12,
              y: touch.clientY - rect.top + 12,
            });
          }
        }}
      >
        <canvas ref={canvasRef} className="ccd-radar-canvas" role="img" aria-label="Readiness versus risk radar" />

        {hovered ? (
          <div
            className="ccd-radar-tooltip"
            style={{
              left: Math.min(tooltipPos.x, dims.width - 200),
              top: Math.min(tooltipPos.y, dims.height - 120),
            }}
            role="status"
          >
            <div className="ccd-radar-tooltip__head">
              <strong>{hovered.symbol}</strong>
              <span className="text-[10px] uppercase text-slate-400">{hovered.action}</span>
            </div>
            <p className="text-xs text-slate-400 m-0">{hovered.reason}</p>
            <p className="text-[10px] font-mono text-slate-500 mt-1 mb-0">
              Readiness {hovered.readiness} · Risk {hovered.risk}
            </p>
            {radar.sparklineProvenance === "derived" ? (
              <p className="text-[9px] text-slate-600 m-0 mt-1 italic">Illustrative trace</p>
            ) : null}
            <Sparkline
              values={signalTrace(hovered.readiness, hovered.risk)}
              color={nodeColor(hovered.classification).fill}
            />
          </div>
        ) : null}
      </div>

      {radar.mapDots.length === 0 ? (
        <p className="ccd-empty mt-2">No candidates plotted on the readiness/risk map.</p>
      ) : null}
    </section>
  );
}
