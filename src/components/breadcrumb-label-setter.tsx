"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setBreadcrumbLabel, clearBreadcrumbLabel } from "@/components/breadcrumb-label-store";

/**
 * Renders nothing — a leaf page mounts this once it has loaded a dynamic-segment
 * entity's display name, so <AppBreadcrumbs> can show it instead of the raw
 * slug/id from the URL.
 */
export function BreadcrumbLabelSetter({ label }: { label: string }) {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    setBreadcrumbLabel(pathname, label);
    return () => clearBreadcrumbLabel(pathname);
  }, [pathname, label]);

  return null;
}
