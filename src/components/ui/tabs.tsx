"use client";

import { useId, useState, type ReactNode } from "react";

export type TabItem = {
  key: string;
  label: string;
  panel: ReactNode;
};

export type TabsProps = {
  items: TabItem[];
  defaultKey?: string;
  ariaLabel: string;
  className?: string;
};

/**
 * Generic tablist/tab/tabpanel primitive — same aria pattern proven in
 * paper-lab/PaperLabWorkspaceTabs.tsx (role=tablist/tab/tabpanel, aria-selected).
 */
export function Tabs({ items, defaultKey, ariaLabel, className = "" }: TabsProps) {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key);
  const baseId = useId();

  return (
    <div className={`tabs ${className}`.trim()}>
      <div className="tabs__list" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.key}`}
              className={`tabs__tab ${selected ? "tabs__tab--active" : ""}`.trim()}
              onClick={() => setActive(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) =>
        item.key === active ? (
          <div
            key={item.key}
            role="tabpanel"
            id={`${baseId}-panel-${item.key}`}
            aria-labelledby={`${baseId}-tab-${item.key}`}
            className="tabs__panel"
          >
            {item.panel}
          </div>
        ) : null
      )}
    </div>
  );
}
