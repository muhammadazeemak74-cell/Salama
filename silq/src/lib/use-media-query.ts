"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook.
 *
 * Uses useSyncExternalStore so the server snapshot is always false and the real
 * value is read during hydration — no state updates from inside an effect, and
 * no flash of the wrong branch on a second render pass.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True only for mouse-like input. Gates the magnetic buttons and the cursor. */
export const usePointerFine = () =>
  useMediaQuery("(hover: hover) and (pointer: fine)");

/** Matches the Tailwind `lg` breakpoint, where the sticky showcase turns on. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
