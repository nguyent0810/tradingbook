"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { isClayThemeRoute } from "@/lib/clay-theme-routes";

type SidebarIcon = (props: { className?: string }) => React.ReactElement;

const IconGrid: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const IconFunnel: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16l-6 8v6l-4 2v-8L4 4z" />
  </svg>
);

const IconTarget: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.5" fill="currentColor" />
  </svg>
);

const IconBook: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
  </svg>
);

const IconBarChart: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20V10M12 20V4M20 20v-6" />
  </svg>
);

const IconEye: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconSettings: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.4.66.74.9.34.24.75.38 1.17.4H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconChevron: SidebarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 6 9 12 15 18" />
  </svg>
);

type SidebarItem = {
  href: string;
  label: string;
  labelVi: string;
  deck: string;
  deckVi: string;
  Icon: SidebarIcon;
};

/** Real, navigable routes. */
const ACTIVE_ITEMS: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", labelVi: "Bảng điều khiển", deck: "Command Deck", deckVi: "Sở chỉ huy", Icon: IconGrid },
  { href: "/setups", label: "Setups", labelVi: "Thiết lập", deck: "Pipeline", deckVi: "Đường ống", Icon: IconFunnel },
  { href: "/paper-lab", label: "Arena", labelVi: "Đấu trường", deck: "Simulation", deckVi: "Mô phỏng", Icon: IconTarget },
  { href: "/book", label: "Book", labelVi: "Sổ lệnh", deck: "Ledger", deckVi: "Nhật ký", Icon: IconBook },
  { href: "/settings", label: "Settings", labelVi: "Cài đặt", deck: "Account", deckVi: "Tài khoản", Icon: IconSettings },
];

/**
 * Visually present, not yet built — no route exists for these today. Kept
 * disabled (no href, aria-disabled) rather than linking to a page that
 * doesn't exist, per product decision to show the full planned nav shape
 * without fabricating functionality.
 */
const COMING_SOON_ITEMS: Array<{ label: string; labelVi: string; deck: string; deckVi: string; Icon: SidebarIcon }> = [
  { label: "Analytics", labelVi: "Phân tích", deck: "Insights", deckVi: "Thống kê", Icon: IconBarChart },
  { label: "Watchlist", labelVi: "Danh mục", deck: "Tracking", deckVi: "Theo dõi", Icon: IconEye },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop left icon-sidebar — primary nav for the authenticated shell (≥768px). */
export function AppShellSidebar() {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  // Clay redesign copy applies only on the redesigned routes — Settings and
  // Arena sub-routes keep the existing English nav labels so this shared
  // sidebar doesn't visually change there.
  const vi = isClayThemeRoute(pathname);

  return (
    <aside
      className={collapsed ? "app-shell-sidebar app-shell-sidebar--collapsed" : "app-shell-sidebar"}
      aria-label="Primary"
    >
      <nav className="app-shell-sidebar__nav">
        {ACTIVE_ITEMS.map(({ href, label, labelVi, deck, deckVi, Icon }) => {
          const active = isNavActive(pathname, href);
          const shownLabel = vi ? labelVi : label;
          return (
            <Link
              key={href}
              href={href}
              className={active ? "app-shell-sidebar-link app-shell-sidebar-link--active" : "app-shell-sidebar-link"}
              aria-current={active ? "page" : undefined}
              title={collapsed ? shownLabel : undefined}
            >
              <Icon className="app-shell-sidebar-link__icon" />
              <span className="app-shell-sidebar-link__text">
                <span className="app-shell-sidebar-link__label">{shownLabel}</span>
                <span className="app-shell-sidebar-link__deck">{vi ? deckVi : deck}</span>
              </span>
            </Link>
          );
        })}

        <div className="app-shell-sidebar__divider" role="separator" aria-hidden="true" />

        {COMING_SOON_ITEMS.map(({ label, labelVi, deck, deckVi, Icon }) => {
          const shownLabel = vi ? labelVi : label;
          return (
            <span
              key={label}
              className="app-shell-sidebar-link app-shell-sidebar-link--disabled"
              aria-disabled="true"
              title={vi ? `${shownLabel} — sắp có` : `${label} — coming soon`}
            >
              <Icon className="app-shell-sidebar-link__icon" />
              <span className="app-shell-sidebar-link__text">
                <span className="app-shell-sidebar-link__label">{shownLabel}</span>
                <span className="app-shell-sidebar-link__deck">{vi ? deckVi : deck}</span>
              </span>
              <span className="app-shell-sidebar-link__badge">{vi ? "Sắp có" : "Soon"}</span>
            </span>
          );
        })}
      </nav>

      <button
        type="button"
        className="app-shell-sidebar__collapse"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <IconChevron
          className={
            collapsed
              ? "app-shell-sidebar__collapse-icon app-shell-sidebar__collapse-icon--collapsed"
              : "app-shell-sidebar__collapse-icon"
          }
        />
        <span className="app-shell-sidebar__collapse-label" aria-hidden="true">
          {vi ? (collapsed ? "Mở rộng" : "Thu gọn") : collapsed ? "Expand" : "Collapse"}
        </span>
      </button>
    </aside>
  );
}
