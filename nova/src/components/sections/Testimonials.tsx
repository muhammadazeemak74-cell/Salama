import { Quote } from "lucide-react";
import { testimonials } from "@/data/content";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Reveal } from "../ui/Reveal";

export function Testimonials() {
  return (
    <Section id="testimonios">
      <Reveal className="max-w-2xl">
        <Eyebrow>{testimonials.eyebrow}</Eyebrow>
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
          {testimonials.title}
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {testimonials.items.map((item, i) => (
          <Reveal key={i} delay={0.1 * i}>
            <figure className="grain flex h-full flex-col rounded-2xl border border-white/60 bg-base/75 p-7 backdrop-blur-md shadow-[0_24px_60px_-42px_rgba(20,48,74,0.5)]">
              <Quote className="h-7 w-7 text-orange/60" strokeWidth={1.5} />
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ink/80">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 border-t border-ink/8 pt-4">
                <p className="text-sm font-semibold text-ink">{item.author}</p>
                <p className="text-xs text-ink/50">{item.origin}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
