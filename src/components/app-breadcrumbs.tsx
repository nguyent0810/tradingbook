"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBreadcrumbLabel } from "@/components/breadcrumb-label-store";

/**
 * Global wayfinding for the authenticated shell.
 *
 * Renders a breadcrumb trail only for NESTED routes (depth ≥ 2) — top-level
 * sections (Dashboard, Setups, Arena) already read their location from the
 * active primary-nav item, so a single-crumb trail there would be redundant
 * noise. Driven entirely by the pathname; no route data is duplicated.
 */
const SEGMENT_LABELS: Record<string, string> = {
  "paper-lab": "Đấu trường",
  agents: "Agent",
  battles: "Đối đầu",
  experiments: "Thử nghiệm",
  hof: "Bảng vàng",
  human: "PM con người",
  ops: "Vận hành",
  timeline: "Dòng thời gian",
};

function labelFor(segment: string): string {
  const known = SEGMENT_LABELS[segment];
  if (known) return known;
  // Dynamic segment (slug / id / date): keep it readable, don't mangle dates.
  return decodeURIComponent(segment);
}

export function AppBreadcrumbs() {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  // Only the last crumb can ever be a dynamic segment a leaf page overrides
  // (agents/[slug], battles/[id]) — intermediate segments are always static.
  const overrideLabel = useBreadcrumbLabel(pathname);

  // Flat top-level route → the active nav item is enough. No breadcrumb.
  if (segments.length < 2) return null;

  const crumbs = segments.map((segment, i) => {
    const isLast = i === segments.length - 1;
    return {
      label: isLast && overrideLabel ? overrideLabel : labelFor(segment),
      href: "/" + segments.slice(0, i + 1).join("/"),
      isLast,
    };
  });

  return (
    <nav className="cd-breadcrumbs" aria-label="Đường dẫn điều hướng">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} style={{ display: "contents" }}>
          {i > 0 && (
            <span className="cd-breadcrumbs__sep" aria-hidden="true">
              /
            </span>
          )}
          {crumb.isLast ? (
            <span className="cd-breadcrumbs__item" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="cd-breadcrumbs__item">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
