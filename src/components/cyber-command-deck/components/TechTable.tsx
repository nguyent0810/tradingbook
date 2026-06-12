"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { TechTableColumn } from "../types";

type Props<T extends { id: string }> = {
  title: string;
  subtitle?: string;
  columns: TechTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  testId?: string;
  className?: string;
  headerExtra?: ReactNode;
  fillHeight?: boolean;
};

export function TechTable<T extends { id: string }>({
  title,
  subtitle,
  columns,
  rows,
  emptyMessage = "No data available.",
  testId,
  className = "",
  headerExtra,
  fillHeight = false,
}: Props<T>) {
  const reducedMotion = useReducedMotion();

  return (
    <section
      className={`ccd-panel p-4 ${fillHeight ? "ccd-panel-fill h-full" : ""} ${className}`.trim()}
      aria-label={title}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="ccd-kicker">{title}</span>
          {subtitle ? (
            <p className="text-xs text-slate-500 m-0 mt-1">{subtitle}</p>
          ) : null}
        </div>
        {headerExtra}
      </div>

      {rows.length === 0 ? (
        <p className="ccd-empty">{emptyMessage}</p>
      ) : (
        <div className="ccd-tech-table-wrap">
          <table className="ccd-tech-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={[
                      col.align === "right" ? "ccd-tech-table__num" : "ccd-tech-table__text",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: reducedMotion ? 0 : index * 0.04,
                    duration: 0.28,
                    ease: "easeOut",
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        col.mono ? "ccd-tech-table__mono" : "ccd-tech-table__text",
                        col.align === "right" ? "ccd-tech-table__num" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
