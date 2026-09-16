"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_ADMIN_TAB, type AdminTabId } from "@/components/app/nav";

/**
 * The open section of the admin console, shared between the page (`AdminView`)
 * and the admin menu in the sidebar / hamburger sheet.
 *
 * A tiny external store rather than `useSearchParams()`: the sidebar lives in
 * the layout, outside the page, and this keeps the highlight correct without
 * dragging a Suspense boundary (and a static-rendering caveat) into the shell.
 * The server snapshot is always the default tab, so server and first client
 * render agree; the real value is read from the URL after mount.
 */

let activeTab: AdminTabId = DEFAULT_ADMIN_TAB;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setActiveAdminTab(tab: AdminTabId): void {
  if (tab === activeTab) return;
  activeTab = tab;
  listeners.forEach((listener) => listener());
}

export function getActiveAdminTab(): AdminTabId {
  return activeTab;
}

export function useActiveAdminTab(): AdminTabId {
  return useSyncExternalStore(subscribe, getActiveAdminTab, () => DEFAULT_ADMIN_TAB);
}
