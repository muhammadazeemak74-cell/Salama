"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";

type CountUpProps = {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  className?: string;
};

/**
 * Counts from zero to the target once the element enters the viewport.
 * Under reduced motion the final value is rendered immediately.
 */
export function CountUp({
  to,
  decimals = 0,
  suffix = "",
  duration = 1.8,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reducedMotion = useSafeReducedMotion();
  const [animated, setAnimated] = useState(0);
  // Reduced motion skips the ramp entirely and renders the final figure.
  const value = reducedMotion ? to : animated;

  useEffect(() => {
    if (!inView || reducedMotion) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / (duration * 1000);
      const progress = Math.min(1, elapsed);
      // Ease-out cubic: quick off the mark, long settle.
      setAnimated(to * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reducedMotion, to, duration]);

  const display = value.toLocaleString("en-AE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      <span className="tnum">{display}</span>
      {suffix}
    </span>
  );
}
