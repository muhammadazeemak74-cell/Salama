import { TRUST_STATS } from "@/content/copy";
import { CountUp } from "@/components/motion/CountUp";
import { RevealBlock } from "@/components/motion/RevealText";

/**
 * Thin dark strip between the hero and the intro statement.
 *
 * TODO(owner): the four values come from TRUST_STATS in src/content/copy.ts and
 * are placeholders. Replace them with numbers you can evidence before launch.
 */
export function TrustBar() {
  return (
    <section aria-label="At a glance" className="on-dark">
      <div className="shell py-14 md:py-16">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4">
          {TRUST_STATS.map((stat, index) => (
            // A single wrapper element between <dl> and its pairs is the most
            // HTML allows; the reveal block is that wrapper.
            <RevealBlock
              key={stat.label}
              delay={index * 0.08}
              className="flex flex-col gap-3"
            >
              <dt className="order-2 text-[0.6875rem] uppercase tracking-[0.2em] text-champagne">
                {stat.label}
              </dt>
              <dd className="order-1 font-display text-[clamp(2.5rem,5vw,4rem)] font-light leading-none tracking-[-0.04em] text-bone">
                <CountUp
                  to={stat.value}
                  decimals={"decimals" in stat ? stat.decimals : 0}
                  suffix={stat.suffix}
                />
              </dd>
            </RevealBlock>
          ))}
        </dl>
      </div>
    </section>
  );
}
