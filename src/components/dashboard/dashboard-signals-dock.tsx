"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type SignalTone = "safe" | "warn" | "danger" | "neutral";

export type DashboardSignalId =
  | "market-data"
  | "scan-pulse"
  | "confidence"
  | "vnindex"
  | "hostility"
  | "verdict";

export type DashboardSignalDescriptor = {
  id: DashboardSignalId;
  icon: ReactNode;
  tone: SignalTone;
  title: string;
  meta: string;
  content: ReactNode;
};

export type DashboardSignalsDockProps = {
  items: DashboardSignalDescriptor[];
};

const POPOVER_WIDTH = 380;
const GAP = 12;
const VIEWPORT_MARGIN = 12;
const EASE = [0.22, 1, 0.36, 1] as const;

type OpenState = {
  id: DashboardSignalId;
  iconRect: DOMRect;
  top: number;
  left: number;
  ready: boolean;
};

function computePosition(iconRect: DOMRect, popoverHeight: number) {
  const left = Math.max(VIEWPORT_MARGIN, iconRect.left - POPOVER_WIDTH - GAP);
  const rawTop = iconRect.top + iconRect.height / 2 - popoverHeight / 2;
  const top = Math.min(
    Math.max(rawTop, VIEWPORT_MARGIN),
    window.innerHeight - popoverHeight - VIEWPORT_MARGIN
  );
  return { top, left };
}

/**
 * Icon-only signals dock (default-collapsed sidebar). Clicking an icon opens
 * a 3D popover anchored beside it via a portal to document.body — the dock's
 * ancestors use overflow/backdrop-filter which would otherwise clip or
 * mis-position a position:fixed popover rendered inline.
 */
export function DashboardSignalsDock({ items }: DashboardSignalsDockProps) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const iconRefs = useRef(new Map<DashboardSignalId, HTMLButtonElement>());
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen((current) => {
      if (current) iconRefs.current.get(current.id)?.focus();
      return null;
    });
  }, []);

  const handleIconClick = useCallback((id: DashboardSignalId) => {
    setOpen((current) => {
      if (current?.id === id) return null;
      const rect = iconRefs.current.get(id)?.getBoundingClientRect();
      if (!rect) return current;
      return { id, iconRect: rect, top: rect.top, left: rect.left - POPOVER_WIDTH - GAP, ready: false };
    });
  }, []);

  // Second measure pass: the popover mounts invisibly at its natural height
  // first, then we read that height and compute the final anchored/clamped
  // position before revealing it.
  useLayoutEffect(() => {
    if (!open || open.ready) return;
    const height = popoverRef.current?.getBoundingClientRect().height ?? 0;
    const { top, left } = computePosition(open.iconRect, height);
    setOpen((current) => (current && !current.ready ? { ...current, top, left, ready: true } : current));
  }, [open]);

  useEffect(() => {
    if (open?.ready) popoverRef.current?.focus();
  }, [open?.ready]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (iconRefs.current.get(open!.id)?.contains(target)) return;
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && popoverRef.current) {
        const focusable = popoverRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    function onScrollOrResize() {
      close();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, close]);

  const openItem = open ? items.find((i) => i.id === open.id) ?? null : null;

  return (
    <aside className="dash-signals-dock" aria-label="Signals" data-testid="dashboard-signals-rail">
      <div className="dash-signals-dock__icons">
        {items.map((item) => {
          const isOpen = open?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              ref={(el) => {
                if (el) iconRefs.current.set(item.id, el);
                else iconRefs.current.delete(item.id);
              }}
              className={`dash-rail-icon dash-rail-icon--${item.tone} dash-dock-trigger`}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              aria-controls={isOpen ? "dash-dock-popover" : undefined}
              aria-label={`${item.title} — ${item.meta}`}
              title={`${item.title} — ${item.meta}`}
              onClick={() => handleIconClick(item.id)}
            >
              {item.icon}
            </button>
          );
        })}
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open && openItem ? (
                <div
                  className="dash-dock-popover-wrapper"
                  style={{ top: open.top, left: open.left }}
                >
                  <motion.div
                    ref={popoverRef}
                    id="dash-dock-popover"
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby="dash-dock-popover-heading"
                    tabIndex={-1}
                    className={`dash-dock-popover dash-dock-popover--${openItem.tone}`}
                    style={{ visibility: open.ready ? "visible" : "hidden" }}
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.92, rotateY: -18, x: 24 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
                    exit={
                      reducedMotion
                        ? { opacity: 0, transition: { duration: 0.001 } }
                        : { opacity: 0, scale: 0.95, rotateY: -10, x: 12, transition: { duration: 0.18 } }
                    }
                    transition={{ duration: reducedMotion ? 0 : 0.42, ease: EASE }}
                  >
                    <h3 id="dash-dock-popover-heading" className="dash-sr-only">
                      {openItem.title}
                    </h3>
                    {openItem.content}
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </aside>
  );
}
