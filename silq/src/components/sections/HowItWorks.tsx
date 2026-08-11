"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { HOW_IT_WORKS } from "@/content/copy";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealBlock } from "@/components/motion/RevealText";

/**
 * Four steps, laid out horizontally on desktop with a hairline that draws
 * itself between them as the section scrolls. The line is decorative and is
 * hidden from assistive technology; the ordered list carries the meaning.
 */
export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useSafeReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.55"],
  });
  const pathLength = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 28,
    restDelta: 0.001,
  });

  return (
    <section id="how-it-works" className="section on-dark">
      <div className="shell">
        <SectionHeading eyebrow={HOW_IT_WORKS.eyebrow} heading={HOW_IT_WORKS.heading} />

        <div ref={ref} className="relative mt-20 lg:mt-28">
          {/* Sits on the centre line of the 9px step markers. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[4px] hidden lg:block">
            <svg
              className="h-px w-full overflow-visible"
              viewBox="0 0 100 1"
              preserveAspectRatio="none"
              focusable="false"
            >
              {/* No non-scaling-stroke here: pathLength drives a dash array in
                  user units, and pinning the stroke to screen pixels would
                  scatter that dash across the stretched viewBox. */}
              <line
                x1="0"
                y1="0.5"
                x2="100"
                y2="0.5"
                stroke="var(--color-champagne)"
                strokeOpacity="0.18"
                strokeWidth="1"
              />
              <motion.line
                x1="0"
                y1="0.5"
                x2="100"
                y2="0.5"
                stroke="var(--color-champagne)"
                strokeWidth="1"
                style={reducedMotion ? { pathLength: 1 } : { pathLength }}
              />
            </svg>
          </div>

          <ol className="grid gap-14 lg:grid-cols-4 lg:gap-10">
            {HOW_IT_WORKS.steps.map((step, index) => (
              <li key={step.number} className="relative lg:pr-6">
                <RevealBlock delay={index * 0.08}>
                  <StepMarker progress={pathLength} index={index} count={HOW_IT_WORKS.steps.length} reducedMotion={Boolean(reducedMotion)} />

                  <p className="eyebrow tnum mt-8 lg:mt-10">{step.number}</p>
                  <h3 className="t-sub opsz-display mt-4">{step.title}</h3>
                  <p className="mt-5">{step.body}</p>
                </RevealBlock>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepMarker({
  progress,
  index,
  count,
  reducedMotion,
}: {
  progress: ReturnType<typeof useSpring>;
  index: number;
  count: number;
  reducedMotion: boolean;
}) {
  // Each dot fills as the drawn line reaches its column.
  const threshold = index / count;
  const scale = useTransform(progress, [threshold, threshold + 0.08], [0, 1]);

  return (
    <div className="relative hidden h-[9px] w-[9px] lg:block">
      <span className="absolute inset-0 rounded-full border border-champagne/30" />
      <motion.span
        className="absolute inset-[2px] rounded-full bg-champagne"
        style={reducedMotion ? { scale: 1 } : { scale }}
      />
    </div>
  );
}
