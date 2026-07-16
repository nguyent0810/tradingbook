"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Renders nothing — moves focus to the main content region on every client-side
 * route change, so keyboard/screen-reader users get a "new page" cue instead of
 * focus silently staying wherever it was (often lost to <body>).
 */
export function FocusMainOnRouteChange({ targetId }: { targetId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    document.getElementById(targetId)?.focus();
  }, [pathname, targetId]);

  return null;
}
