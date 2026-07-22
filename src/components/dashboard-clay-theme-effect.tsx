"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { isClayThemeRoute } from "@/lib/clay-theme-routes";

const CLASS = "dash-clay-active";

export type DashboardClayThemeEffectProps = {
  /** next/font `.variable` class names (Baloo 2 / Nunito) — applied to
   *  <body> itself, not just a wrapper div, so the CSS custom properties
   *  they define also reach DashboardSignalsDock's popover, which portals
   *  straight to document.body, outside any wrapper's subtree. */
  fontVariableClassName: string;
};

/**
 * Toggles a body class on the Clay-redesigned routes (Dashboard, Setups,
 * Arena overview) so the ClayMorphism reskin (dashboard-clay-theme.css)
 * applies only there — Settings and every Arena sub-route share the same
 * shell markup and must render unchanged.
 */
export function DashboardClayThemeEffect({ fontVariableClassName }: DashboardClayThemeEffectProps) {
  const pathname = usePathname() ?? "";

  useLayoutEffect(() => {
    const isClayRoute = isClayThemeRoute(pathname);
    const fontClasses = fontVariableClassName.split(" ").filter(Boolean);
    document.body.classList.toggle(CLASS, isClayRoute);
    if (isClayRoute) {
      document.body.classList.add(...fontClasses);
    } else {
      document.body.classList.remove(...fontClasses);
    }
    return () => {
      document.body.classList.remove(CLASS, ...fontClasses);
    };
  }, [pathname, fontVariableClassName]);

  return null;
}
