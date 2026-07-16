"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny external store mapping pathname -> a human-readable breadcrumb label.
 * Lets leaf pages that fetch a dynamic-segment entity (agent, battle, ...)
 * hand its display name to <AppBreadcrumbs>, which otherwise only has the
 * raw URL segment (a slug or database id) to show.
 */
type Listener = () => void;

const labels = new Map<string, string>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setBreadcrumbLabel(path: string, label: string) {
  if (labels.get(path) === label) return;
  labels.set(path, label);
  emit();
}

export function clearBreadcrumbLabel(path: string) {
  if (!labels.has(path)) return;
  labels.delete(path);
  emit();
}

export function useBreadcrumbLabel(path: string): string | undefined {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => labels.get(path),
    () => undefined
  );
}
