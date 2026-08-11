"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { FAQS, type FaqItem } from "@/content/faq";
import { FAQ_SECTION } from "@/content/copy";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Keyboard-navigable accordion. Buttons carry aria-expanded and aria-controls,
 * and the panel is a plain region that stays in the DOM order it reads in.
 */
export function Faq({ items = FAQS, id = "faq" }: { items?: FaqItem[]; id?: string }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id={id} className="section">
      <div className="shell lg:grid lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow={FAQ_SECTION.eyebrow} heading={FAQ_SECTION.heading} />
        </div>

        <div className="mt-14 lg:col-span-8 lg:mt-0">
          <ul>
            {items.map((item, index) => (
              <AccordionRow
                key={item.question}
                item={item}
                isOpen={open === index}
                onToggle={() => setOpen(open === index ? null : index)}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AccordionRow({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const reducedMotion = useSafeReducedMotion();

  return (
    <li className="hairline last:border-b last:border-b-champagne/40">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="group flex w-full items-start justify-between gap-8 py-7 text-left"
        >
          <span className="font-display text-[clamp(1.125rem,1.9vw,1.5rem)] font-light leading-[1.2] tracking-[-0.025em] text-ink transition-colors duration-300 group-hover:text-clay-deep">
            {item.question}
          </span>
          <span aria-hidden className="relative mt-2 block h-3 w-3 shrink-0">
            <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-clay" />
            <motion.span
              className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-clay"
              animate={{ scaleY: isOpen ? 0 : 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            id={panelId}
            key="panel"
            initial={reducedMotion ? { height: "auto" } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? { height: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-8 pr-8">{item.answer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
