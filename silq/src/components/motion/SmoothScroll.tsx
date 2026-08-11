"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Lenis smooth scroll. Lenis drives the real window scroll position, so
 * Framer's useScroll and IntersectionObserver both keep working unchanged.
 *
 * Entirely disabled under prefers-reduced-motion — the browser's own scrolling
 * is the accessible default and should not be replaced.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useSafeReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const lenis = new Lenis({
      duration: 1.2,
      // Exponential ease-out: fast to settle, long tail, no rubber-band feel.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Wheel only. Touch devices keep native momentum, which feels better.
      smoothWheel: true,
      touchMultiplier: 2,
      anchors: true,
    });

    let frame = requestAnimationFrame(function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
