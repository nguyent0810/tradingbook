"use client";

import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { isClayThemeRoute } from "@/lib/clay-theme-routes";

export function LogoutButton() {
  // Clay redesign copy applies only on the redesigned routes — see AppShellSidebar.
  const isClayRoute = isClayThemeRoute(usePathname() ?? "");

  return (
    <form action={logout}>
      <button type="submit" className="cd-nav-signout" data-testid="nav-signout">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="hidden sm:inline">{isClayRoute ? "Đăng xuất" : "Sign out"}</span>
      </button>
    </form>
  );
}
