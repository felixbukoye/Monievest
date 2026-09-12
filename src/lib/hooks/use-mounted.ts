"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

/**
 * Hydration-safe "have we mounted?" flag.
 *
 * `useSyncExternalStore` renders `getServerSnapshot` during SSR *and* during
 * hydration, then switches to `getSnapshot` — so there is no flash and no
 * mismatch, and no `setState` inside an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, getTrue, getFalse);
}
