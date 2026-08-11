"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const subscribeNever = () => () => {};

/**
 * Hydration-safe reduced-motion flag.
 *
 * The server has no media queries, so it always renders the animated markup.
 * If a component reads the real preference on its very first client render, the
 * two trees disagree and React throws a hydration error for anyone browsing
 * with "reduce motion" on. This reports false until the client has hydrated,
 * then flips to the user's actual preference.
 */
export function useSafeReducedMotion(): boolean {
  const prefersReduced = Boolean(useReducedMotion());
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return hydrated && prefersReduced;
}
