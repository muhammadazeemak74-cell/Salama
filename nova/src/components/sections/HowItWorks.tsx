import { howItWorks } from "@/data/content";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Reveal } from "../ui/Reveal";
import { Icon } from "../ui/Icon";

export function HowItWorks() {
  return (
    <Section id="como-funciona">
      <Reveal className="max-w-2xl">
        <Eyebrow>{howItWorks.eyebrow}</Eyebrow>
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
          {howItWorks.title}
        </h2>
      </Reveal>

      <div className="relative mt-16">
        {/* The signature dotted route, echoed connecting the three steps. */}
        <div
          className="dotted-rule absolute left-0 right-0 top-7 hidden md:block"
          aria-hidden="true"
        />
        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {howItWorks.steps.map((step, i) => (
            <Reveal key={step.number} delay={0.12 * i}>
              <div className="relative">
                <div className="flex items-center gap-4">
                  <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-teal/25 bg-base text-teal-deep shadow-sm">
                    <Icon name={step.icon} className="h-6 w-6" />
                  </span>
                  <span className="font-display text-4xl font-semibold text-sand-deep">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink/65">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
