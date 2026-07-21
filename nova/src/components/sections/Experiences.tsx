import { experiences } from "@/data/content";
import type { ResolvedImages } from "@/lib/unsplash";
import { Eyebrow } from "../ui/Eyebrow";
import { Reveal } from "../ui/Reveal";
import { WhatsAppButton } from "../ui/WhatsAppButton";
import { ExperienceCard } from "./ExperienceCard";

export function Experiences({ images }: { images: ResolvedImages }) {
  return (
    // Wider than the other sections so the flyers render large and readable.
    <section
      id="experiencias"
      className="relative mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 sm:py-32"
    >
      <Reveal className="max-w-2xl">
        <Eyebrow>{experiences.eyebrow}</Eyebrow>
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
          {experiences.title}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-ink/70">
          {experiences.subtitle}
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {experiences.items.map((experience, i) => (
          <ExperienceCard
            key={experience.slug}
            experience={experience}
            image={images[experience.imageSlot]}
            index={i}
          />
        ))}
      </div>

      <Reveal delay={0.1} className="mt-14 flex justify-center">
        <WhatsAppButton />
      </Reveal>
    </section>
  );
}
