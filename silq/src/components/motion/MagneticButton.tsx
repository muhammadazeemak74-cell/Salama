"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { usePointerFine } from "@/lib/use-media-query";

const RADIUS = 80;
const PULL = 0.35;

type MagneticProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  type?: "button" | "submit";
  target?: string;
  rel?: string;
  disabled?: boolean;
};

/**
 * Cursor-following transform. The element leans toward the pointer once it is
 * within 80px and springs back on leave. Mouse input only — on touch it renders
 * as a plain link or button with no listeners attached.
 */
export function MagneticButton({
  children,
  className,
  href,
  onClick,
  ariaLabel,
  type = "button",
  target,
  rel,
  disabled,
}: MagneticProps) {
  const ref = useRef<HTMLElement | null>(null);
  const pointerFine = usePointerFine();
  const reducedMotion = useSafeReducedMotion();
  const active = pointerFine && !reducedMotion;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });

  const handleMove = (event: React.MouseEvent<HTMLElement>) => {
    if (!active || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    // Only pull once the pointer is inside the magnetic radius of the edge.
    const distance = Math.hypot(
      Math.max(0, Math.abs(dx) - rect.width / 2),
      Math.max(0, Math.abs(dy) - rect.height / 2),
    );
    if (distance > RADIUS) return;
    x.set(dx * PULL);
    y.set(dy * PULL);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const motionProps = {
    ref: ref as never,
    className,
    style: active ? { x: springX, y: springY } : undefined,
    onMouseMove: active ? handleMove : undefined,
    onMouseLeave: active ? handleLeave : undefined,
    "aria-label": ariaLabel,
  };

  if (href) {
    return (
      <motion.a {...motionProps} href={href} target={target} rel={rel}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button {...motionProps} type={type} onClick={onClick} disabled={disabled}>
      {children}
    </motion.button>
  );
}

/**
 * Wraps content that already renders its own element — used to give the
 * magnetic behaviour to a Next <Link> without nesting anchors.
 */
export function MagneticWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerFine = usePointerFine();
  const reducedMotion = useSafeReducedMotion();
  const active = pointerFine && !reducedMotion;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={active ? { x: springX, y: springY } : undefined}
      onMouseMove={
        active
          ? (event) => {
              if (!ref.current) return;
              const rect = ref.current.getBoundingClientRect();
              const dx = event.clientX - (rect.left + rect.width / 2);
              const dy = event.clientY - (rect.top + rect.height / 2);
              const distance = Math.hypot(
                Math.max(0, Math.abs(dx) - rect.width / 2),
                Math.max(0, Math.abs(dy) - rect.height / 2),
              );
              if (distance > RADIUS) return;
              x.set(dx * PULL);
              y.set(dy * PULL);
            }
          : undefined
      }
      onMouseLeave={
        active
          ? () => {
              x.set(0);
              y.set(0);
            }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}
