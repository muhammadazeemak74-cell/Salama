import { TESTIMONIALS } from "@/content/testimonials";
import { TESTIMONIALS_SECTION } from "@/content/copy";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealBlock } from "@/components/motion/RevealText";

/**
 * Three pull-quotes. No stars, no avatars, no rating widgets — the typography
 * carries it.
 *
 * TODO(owner): replace the placeholder quotes and attributions in
 * src/content/testimonials.ts with real, attributable client reviews.
 */
export function Testimonials() {
  return (
    <section id="testimonials" className="section">
      <div className="shell">
        <SectionHeading
          eyebrow={TESTIMONIALS_SECTION.eyebrow}
          heading={TESTIMONIALS_SECTION.heading}
        />

        <div className="mt-16 grid gap-x-12 gap-y-14 lg:mt-24 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <RevealBlock key={testimonial.quote} delay={index * 0.1}>
              <figure className="hairline flex h-full flex-col pt-8">
                <blockquote className="t-quote text-ink">
                  <p className="text-ink">&ldquo;{testimonial.quote}&rdquo;</p>
                </blockquote>
                <figcaption className="mt-8 text-[0.8125rem] uppercase tracking-[0.18em] text-ash">
                  {testimonial.name}
                  <span className="mt-1 block normal-case tracking-normal text-clay-deep">
                    {testimonial.detail}
                  </span>
                </figcaption>
              </figure>
            </RevealBlock>
          ))}
        </div>
      </div>
    </section>
  );
}
