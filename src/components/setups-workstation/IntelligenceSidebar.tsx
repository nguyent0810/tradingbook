"use client";

import { memo, useCallback, useId, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SetupsStanceCompact } from "@/components/setups/setups-stance-compact";
import { SetupsFunnelCompact } from "@/components/setups/setups-funnel-compact";
import { SetupsDiagnosticsStack } from "@/components/setups/setups-diagnostics-stack";
import type { IntelligenceSidebarProps } from "./types";
import "./setups-workstation.css";

type TabId = "stance" | "funnel" | "diagnostics";

const VALID_TABS: readonly TabId[] = ["stance", "funnel", "diagnostics"];

export function IntelligenceSidebar({
  tradingDecision,
  latestScan,
  nearMissCount,
  rejectionBuckets,
  scanNotes,
}: IntelligenceSidebarProps) {
  const defaultTab: TabId = tradingDecision ? "stance" : "funnel";
  const panelId = useId();
  const reducedMotion = useReducedMotion() ?? false;

  // Tab lives in the URL (?sidebarTab=) instead of local state — so navigating
  // away (e.g. to a setup detail) and back via browser history restores it,
  // instead of silently resetting to the default tab.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("sidebarTab");
  const tab: TabId =
    requestedTab && (VALID_TABS as string[]).includes(requestedTab)
      ? (requestedTab as TabId)
      : defaultTab;

  const tabs: { id: TabId; label: string }[] = useMemo(
    () => [
      { id: "stance", label: "Lập trường" },
      { id: "funnel", label: "Đường ống" },
      { id: "diagnostics", label: "Chẩn đoán" },
    ],
    []
  );

  const handleTabChange = useCallback(
    (nextTab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === defaultTab) {
        params.delete("sidebarTab");
      } else {
        params.set("sidebarTab", nextTab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [defaultTab, pathname, router, searchParams]
  );

  const isNoTrade = tradingDecision?.level === "NO_TRADE";

  return (
    <aside
      className="sw-glass-panel flex h-full flex-col overflow-hidden"
      data-testid="setups-sidebar"
      aria-label="Bảng thông tin đường ống"
    >
      <div
        className="relative flex border-b border-[var(--border-primary)]/60"
        role="tablist"
        aria-label="Thông tin đường ống"
      >
        {tabs.map((t) => (
          <SidebarTabButton
            key={t.id}
            panelId={panelId}
            tab={t}
            active={tab === t.id}
            onSelect={handleTabChange}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {tab === "stance" ? (
            <motion.div
              key="stance"
              role="tabpanel"
              id={`${panelId}-panel-stance`}
              aria-labelledby={`${panelId}-tab-stance`}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={
                reducedMotion
                  ? undefined
                  : { opacity: 0, y: -4, transition: { duration: 0.1 } }
              }
              transition={{ duration: reducedMotion ? 0 : 0.15 }}
            >
              {tradingDecision ? (
                <div className={isNoTrade ? "sw-stance-pulse rounded-lg" : undefined}>
                  <SetupsStanceCompact decision={tradingDecision} />
                </div>
              ) : (
                <p className="text-sm text-[var(--text-tertiary)]">Không có lập trường giao dịch cho lần quét này.</p>
              )}
            </motion.div>
          ) : null}

          {tab === "funnel" ? (
            <motion.div
              key="funnel"
              role="tabpanel"
              id={`${panelId}-panel-funnel`}
              aria-labelledby={`${panelId}-tab-funnel`}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={
                reducedMotion
                  ? undefined
                  : { opacity: 0, y: -4, transition: { duration: 0.1 } }
              }
              transition={{ duration: reducedMotion ? 0 : 0.15 }}
            >
              <SetupsFunnelCompact latestScan={latestScan} nearMissCount={nearMissCount} />
            </motion.div>
          ) : null}

          {tab === "diagnostics" ? (
            <motion.div
              key="diagnostics"
              role="tabpanel"
              id={`${panelId}-panel-diagnostics`}
              aria-labelledby={`${panelId}-tab-diagnostics`}
              className="max-h-[min(60vh,480px)] overflow-y-auto"
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={
                reducedMotion
                  ? undefined
                  : { opacity: 0, y: -4, transition: { duration: 0.1 } }
              }
              transition={{ duration: reducedMotion ? 0 : 0.15 }}
            >
              <SetupsDiagnosticsStack
                rejectionBuckets={rejectionBuckets}
                scanNotes={scanNotes}
                latestScan={latestScan}
                title="Chẩn đoán lý do bị loại"
                subtitle="Vì sao thiết lập chưa đạt"
                embedded
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </aside>
  );
}

const SidebarTabButton = memo(function SidebarTabButton({
  panelId,
  tab,
  active,
  onSelect,
  reducedMotion,
}: {
  panelId: string;
  tab: { id: TabId; label: string };
  active: boolean;
  onSelect: (tab: TabId) => void;
  reducedMotion: boolean;
}) {
  const handleClick = useCallback(() => onSelect(tab.id), [onSelect, tab.id]);

  return (
    <button
      type="button"
      role="tab"
      id={`${panelId}-tab-${tab.id}`}
      aria-selected={active}
      aria-controls={`${panelId}-panel-${tab.id}`}
      className="relative flex-1 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] transition hover:text-[var(--text-secondary)]"
      onClick={handleClick}
    >
      {active ? (
        <motion.span
          layoutId={reducedMotion ? undefined : "setups-tab-pill"}
          className="absolute inset-x-1 inset-y-1 rounded-md bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30"
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
        />
      ) : null}
      <span className={`relative z-10 ${active ? "text-[var(--accent-text)]" : ""}`}>{tab.label}</span>
    </button>
  );
});
