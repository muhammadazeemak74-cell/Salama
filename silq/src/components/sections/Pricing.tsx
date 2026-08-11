import { PRICE_GROUPS, formatAed } from "@/content/pricing";
import { PRICING_SECTION } from "@/content/copy";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealBlock } from "@/components/motion/RevealText";

/**
 * An editorial price list rather than a grid of cards: rows, hairlines and
 * tabular figures, the way a printed menu would set it.
 */
export function Pricing() {
  return (
    <section id="pricing" className="section">
      <div className="shell">
        <SectionHeading eyebrow={PRICING_SECTION.eyebrow} heading={PRICING_SECTION.heading} />

        <div className="mt-16 lg:mt-24">
          {PRICE_GROUPS.map((group, groupIndex) => (
            <RevealBlock key={group.title} delay={groupIndex * 0.05}>
              <div className="mt-16 first:mt-0 lg:grid lg:grid-cols-12 lg:gap-12">
                <h3 className="eyebrow lg:col-span-3 lg:pt-6">{group.title}</h3>

                <dl className="mt-6 lg:col-span-9 lg:mt-0">
                  {group.rows.map((row) => (
                    <div
                      key={row.name}
                      className="hairline flex items-baseline justify-between gap-6 py-5 first:border-t-0 lg:first:border-t lg:py-6"
                    >
                      <dt className="font-display text-[clamp(1.125rem,2vw,1.625rem)] font-light tracking-[-0.025em] text-ink">
                        {row.name}
                        {row.note ? (
                          <span className="ml-3 font-sans text-[0.8125rem] tracking-normal text-ash">
                            {row.note}
                          </span>
                        ) : null}
                      </dt>
                      <dd className="shrink-0 text-[0.9375rem] text-ash">
                        from{" "}
                        <span className="tnum text-ink">{formatAed(row.from)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </RevealBlock>
          ))}
        </div>

        <RevealBlock delay={0.1}>
          <p className="mt-16 max-w-2xl border-l border-clay/40 pl-6 text-[0.9375rem] leading-relaxed text-ash">
            {PRICING_SECTION.disclaimer}
          </p>
        </RevealBlock>
      </div>
    </section>
  );
}
