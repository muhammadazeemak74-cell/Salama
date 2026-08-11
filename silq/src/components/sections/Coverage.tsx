"use client";

import { motion } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { AREAS } from "@/content/areas";
import { COVERAGE } from "@/content/copy";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealBlock } from "@/components/motion/RevealText";

/**
 * Areas served, staggered in as a tag cloud. The list is also the source for
 * the `areaServed` entries in the structured data, so it stays in one place.
 */
export function Coverage() {
  const reducedMotion = useSafeReducedMotion();

  return (
    <section id="coverage" className="section">
      <div className="shell">
        <SectionHeading eyebrow={COVERAGE.eyebrow} heading={COVERAGE.heading} />

        <motion.ul
          className="mt-16 flex flex-wrap gap-x-3 gap-y-4 lg:mt-20"
          initial={reducedMotion ? undefined : "hidden"}
          whileInView={reducedMotion ? undefined : "shown"}
          viewport={{ once: true, margin: "0px 0px -20% 0px" }}
          variants={{
            hidden: {},
            shown: { transition: { staggerChildren: 0.035 } },
          }}
        >
          {AREAS.map((area) => (
            <motion.li
              key={area}
              variants={{
                hidden: { opacity: 0, y: 14 },
                shown: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-full border border-champagne/60 px-5 py-2.5 font-display text-[clamp(1rem,1.6vw,1.5rem)] font-light tracking-[-0.02em] text-ink transition-colors duration-300 hover:border-clay-deep hover:text-clay-deep"
            >
              {area}
            </motion.li>
          ))}
        </motion.ul>

        <RevealBlock delay={0.1}>
          <p className="mt-12 text-clay-deep">{COVERAGE.note}</p>
        </RevealBlock>
      </div>
    </section>
  );
}
