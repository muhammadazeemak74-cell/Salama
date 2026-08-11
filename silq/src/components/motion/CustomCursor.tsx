"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { usePointerFine } from "@/lib/use-media-query";

/**
 * A small clay dot that replaces the pointer, growing into a 48px disc labelled
 * VIEW over anything marked `data-cursor="view"`.
 *
 * Never rendered on touch devices or under reduced motion, and the native
 * cursor is only hidden while this component is actually mounted.
 */
export function CustomCursor() {
  const pointerFine = usePointerFine();
  const reducedMotion = useSafeReducedMotion();
  const active = pointerFine && !reducedMotion;

  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 900, damping: 50, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 900, damping: 50, mass: 0.35 });

  useEffect(() => {
    if (!active) return;

    document.documentElement.classList.add("has-custom-cursor");

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);
      const target = event.target as Element | null;
      setHovering(Boolean(target?.closest?.('[data-cursor="view"]')));
    };
    const onLeave = () => setVisible(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [active, x, y]);

  if (!active) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] flex items-center justify-center rounded-full bg-clay text-bone mix-blend-normal"
      style={{ x: springX, y: springY, translateX: "-50%", translateY: "-50%" }}
      animate={{
        width: hovering ? 48 : 8,
        height: hovering ? 48 : 8,
        opacity: visible ? 1 : 0,
      }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <AnimatePresence>
        {hovering ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            className="text-[0.5rem] font-medium uppercase tracking-[0.18em]"
          >
            View
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
