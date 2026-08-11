"use client";

import { motion } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import type { ElementType, ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, margin: "0px 0px -30% 0px" } as const;

type RevealTextProps = {
  /** One entry per line. Each line is masked and rises independently. */
  lines: readonly string[];
  as?: ElementType;
  className?: string;
  lineClassName?: string;
  /**
   * Class applied to the final line only. Each line renders inside its own
   * wrapper, so a `last:` variant would match every line — this is the way to
   * accent the closing line.
   */
  lastLineClassName?: string;
  /** Extra delay before the first line, for staggering against neighbours. */
  delay?: number;
};

/**
 * Line-by-line mask reveal. Each line sits inside an overflow-hidden block and
 * slides up from beneath it, so the copy appears to be uncovered rather than
 * faded in. Fires once, when the block reaches 70% of the viewport.
 *
 * Reduced motion changes the animation values, never the markup — branching the
 * DOM on a client-only preference breaks hydration.
 */
export function RevealText({
  lines,
  as: Tag = "p",
  className,
  lineClassName,
  lastLineClassName,
  delay = 0,
}: RevealTextProps) {
  const reducedMotion = useSafeReducedMotion();

  const classFor = (index: number) =>
    [lineClassName, index === lines.length - 1 ? lastLineClassName : null]
      .filter(Boolean)
      .join(" ");

  return (
    <Tag className={className}>
      {lines.map((line, index) => (
        // The viewport trigger has to live on the mask, not on the line inside
        // it. A line translated fully out of an overflow-hidden parent is
        // clipped to an empty rect, and IntersectionObserver would never report
        // it as visible — so the reveal would never fire.
        <motion.span
          key={line}
          className="block overflow-hidden pb-[0.12em]"
          initial="hidden"
          whileInView="shown"
          viewport={VIEWPORT}
        >
          <motion.span
            className={`block ${classFor(index)}`}
            variants={{
              hidden: { y: reducedMotion ? "0%" : "110%" },
              shown: { y: "0%" },
            }}
            transition={{
              duration: reducedMotion ? 0 : 0.95,
              delay: reducedMotion ? 0 : delay + index * 0.08,
              ease: EASE,
            }}
          >
            {line}
          </motion.span>
        </motion.span>
      ))}
    </Tag>
  );
}

/**
 * The same reveal for arbitrary content — an image, a rule, a row of stats.
 */
export function RevealBlock({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reducedMotion = useSafeReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{
        duration: reducedMotion ? 0 : 0.9,
        delay: reducedMotion ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </motion.div>
  );
}
