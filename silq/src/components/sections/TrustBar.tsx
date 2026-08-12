import { TRUST_STATS } from "@/content/site";
import { CountUp } from "@/components/motion/CountUp";
import { RevealBlock } from "@/components/motion/RevealText";

/**
 * Thin dark strip between the hero and the intro statement.
 *
 * Renders only the stats that have a value, and renders nothing at all when
 * none do. Real figures only — see the note on TrustStat in content/site.ts.
 * Shipping a plausible-looking placeholder rating is worse than shipping no
 * rating, so the section is built to be honestly empty.
 */
export function TrustBar() {
  const stats = TRUST_STATS.filter(
    (stat): stat is typeof stat & { value: number } => stat.value !== null,
  );

  if (stats.length === 0) return null;

  return (
    <section aria-label="At a glance" className="on-dark">
      <div className="shell py-14 md:py-16">
        <dl
          className={`grid gap-x-8 gap-y-12 ${
            stats.length === 1
              ? "grid-cols-1"
              : stats.length === 2
                ? "grid-cols-2"
                : stats.length === 3
                  ? "grid-cols-2 md:grid-cols-3"
                  : "grid-cols-2 md:grid-cols-4"
          }`}
        >
          {stats.map((stat, index) => (
            // A single wrapper element between <dl> and its pairs is the most
            // HTML allows; the reveal block is that wrapper.
            <RevealBlock key={stat.label} delay={index * 0.08} className="flex flex-col gap-3">
              <dt className="order-2 text-[0.6875rem] uppercase tracking-[0.2em] text-champagne">
                {stat.label}
              </dt>
              <dd className="order-1 font-display text-[clamp(2.5rem,5vw,4rem)] font-light leading-none tracking-[-0.04em] text-bone">
                <CountUp to={stat.value} decimals={stat.decimals ?? 0} suffix={stat.suffix ?? ""} />
              </dd>
            </RevealBlock>
          ))}
        </dl>
      </div>
    </section>
  );
}
