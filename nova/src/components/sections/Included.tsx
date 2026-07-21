import { included } from "@/data/content";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Reveal } from "../ui/Reveal";
import { Icon } from "../ui/Icon";

export function Included() {
  return (
    <Section id="incluido">
      <Reveal>
        <div className="grain relative overflow-hidden rounded-[2rem] border border-orange/15 bg-sand/80 p-8 backdrop-blur-md sm:p-12">
          <div className="max-w-xl">
            <Eyebrow>{included.eyebrow}</Eyebrow>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              {included.title}
            </h2>
          </div>

          <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {included.items.map((item, i) => (
              <Reveal key={item.title} delay={0.07 * i}>
                <div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-orange-deep ring-1 ring-orange/20">
                    <Icon name={item.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
