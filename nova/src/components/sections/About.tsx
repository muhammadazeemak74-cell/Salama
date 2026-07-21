import { about } from "@/data/content";
import type { ResolvedImage } from "@/lib/unsplash";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Reveal } from "../ui/Reveal";
import { Icon } from "../ui/Icon";
import { SmartImage } from "../ui/SmartImage";

export function About({
  imagePrimary,
  imageSecondary,
}: {
  imagePrimary: ResolvedImage | null;
  imageSecondary: ResolvedImage | null;
}) {
  return (
    <Section id="nosotros">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        {/* Text + pillars */}
        <div className="lg:col-span-7">
          <Reveal>
            <Eyebrow>{about.eyebrow}</Eyebrow>
            <h2 className="max-w-xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
              {about.title}
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink/70">
              {about.body}
            </p>
          </Reveal>

          <div className="mt-12 grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {about.pillars.map((pillar, i) => (
              <Reveal key={pillar.title} delay={0.08 * i}>
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal-deep ring-1 ring-teal/15">
                    <Icon name={pillar.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {pillar.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Image collage */}
        <div className="lg:col-span-5">
          <Reveal delay={0.15}>
            <div className="relative">
              <div className="grain relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] border border-white/50 shadow-[0_40px_80px_-45px_rgba(20,48,74,0.5)]">
                <SmartImage
                  image={imagePrimary}
                  slot="aboutPrimary"
                  alt="Dubái Marina de noche"
                  sizes="(min-width: 1024px) 38vw, 90vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/35 to-transparent" />
              </div>
              <div className="grain absolute -bottom-8 -left-6 hidden aspect-square w-40 overflow-hidden rounded-2xl border-4 border-base shadow-xl sm:block">
                <SmartImage
                  image={imageSecondary}
                  slot="aboutSecondary"
                  alt="Dubái histórico"
                  sizes="160px"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
