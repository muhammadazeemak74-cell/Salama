"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import type { Experience } from "@/data/content";
import type { ResolvedImage } from "@/lib/unsplash";
import { SmartImage } from "../ui/SmartImage";
import { ZoomableImage } from "../ui/ZoomableImage";

export function ExperienceCard({
  experience,
  image,
  index,
}: {
  experience: Experience;
  image: ResolvedImage | null;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.6,
        delay: (index % 3) * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-base shadow-[0_24px_60px_-40px_rgba(20,48,74,0.55)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_36px_80px_-40px_rgba(20,48,74,0.6)]"
    >
      {experience.flyer ? (
        // Client flyer — square, full and UNCROPPED, click to enlarge.
        <div className="bg-white p-2.5">
          <ZoomableImage
            src={experience.flyer}
            alt={`Folleto — ${experience.title}`}
            width={2508}
            height={2508}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 92vw"
            quality={90}
            imgClassName="rounded-lg"
            hint="Ver folleto completo"
          />
        </div>
      ) : (
        <div className="relative aspect-square w-full overflow-hidden">
          <SmartImage
            image={image}
            slot={experience.imageSlot}
            alt={experience.title}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 92vw"
            className="transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-[11px] font-semibold text-teal-deep ring-1 ring-teal/15">
          <Users className="h-3 w-3" strokeWidth={2.2} />
          {experience.groupSize}
        </span>
        <h3 className="font-display text-xl font-semibold leading-snug text-ink">
          {experience.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/65">
          {experience.description}
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-ink/8 pt-4 text-xs text-ink/55">
          {experience.highlights.map((h) => (
            <li key={h} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-orange" aria-hidden="true" />
              {h}
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  );
}
