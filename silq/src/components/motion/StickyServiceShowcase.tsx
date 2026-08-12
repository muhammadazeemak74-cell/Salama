"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { getImage } from "@/content/images";
import type { Service } from "@/content/services";
import { SERVICES_SECTION } from "@/content/copy";
import { formatAed } from "@/content/pricing";
import { enquiryMessage, whatsappLink } from "@/lib/whatsapp";

/**
 * The centrepiece. A sticky left column holds one large image that cross-fades
 * between services as the right column's blocks scroll past it.
 *
 * Desktop only. Below `lg` it degrades to a plain vertical stack of full-bleed
 * image followed by text, which is the right reading order on a phone anyway.
 */
export function StickyServiceShowcase({ services }: { services: Service[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useSafeReducedMotion();

  // Block j sits level with the sticky panel at progress j / (count - 1).
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <>
      {/* ---------- Desktop: sticky cross-fade ---------- */}
      <div ref={ref} className="relative hidden lg:grid lg:grid-cols-2 lg:gap-x-16 xl:gap-x-24">
        <div className="sticky top-0 h-screen">
          {/* Top padding clears the fixed nav; the frame stays optically centred. */}
          <div className="relative h-full w-full overflow-hidden pb-[8vh] pt-[calc(5rem+4vh)]">
            <div className="relative h-full w-full overflow-hidden bg-champagne/30">
              {services.map((service, index) => (
                <ShowcaseImage
                  key={service.slug}
                  service={service}
                  index={index}
                  count={services.length}
                  progress={scrollYProgress}
                  reducedMotion={Boolean(reducedMotion)}
                />
              ))}
            </div>
          </div>
        </div>

        <ol className="min-w-0">
          {services.map((service, index) => (
            <li
              key={service.slug}
              className="flex min-h-screen flex-col justify-center py-16"
            >
              <ServiceBlock service={service} index={index} />
            </li>
          ))}
        </ol>
      </div>

      {/* ---------- Mobile / tablet: stacked ---------- */}
      <ol className="lg:hidden">
        {services.map((service, index) => {
          const image = getImage(service.image);
          return (
            <li key={service.slug} className="pt-16 first:pt-0">
              <div className="relative -mx-6 aspect-[4/5] overflow-hidden bg-champagne/30 md:-mx-12">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="100vw"
                  placeholder="blur"
                  blurDataURL={image.blurDataURL}
                  className="object-cover"
                />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-champagne opacity-[0.08] mix-blend-multiply"
              />
              </div>
              <div className="pt-10">
                <ServiceBlock service={service} index={index} />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function ShowcaseImage({
  service,
  index,
  count,
  progress,
  reducedMotion,
}: {
  service: Service;
  index: number;
  count: number;
  progress: MotionValue<number>;
  reducedMotion: boolean;
}) {
  const image = getImage(service.image);
  const step = 1 / Math.max(1, count - 1);
  const centre = index * step;
  const isFirst = index === 0;
  const isLast = index === count - 1;

  // Hold at full opacity across the middle of the block, cross-fade at the seams.
  //
  // The ranges are trimmed at the ends rather than allowed to run past 0 and 1.
  // Motion hands scroll-linked transforms to the browser's native scroll
  // timeline, and WAAPI rejects keyframe offsets outside [0, 1].
  const opacityRange = isFirst
    ? [0, centre + step * 0.5, centre + step]
    : isLast
      ? [centre - step, centre - step * 0.5, 1]
      : [centre - step, centre - step * 0.5, centre + step * 0.5, centre + step];
  const opacityOutput = isFirst ? [1, 1, 0] : isLast ? [0, 1, 1] : [0, 1, 1, 0];

  const scaleRange = isFirst
    ? [0, centre + step]
    : isLast
      ? [centre - step, 1]
      : [centre - step, centre, centre + step];
  const scaleOutput = isFirst ? [1, 1.06] : isLast ? [1.06, 1] : [1.06, 1, 1.06];

  const opacity = useTransform(progress, opacityRange, opacityOutput);
  const scale = useTransform(progress, scaleRange, scaleOutput);

  return (
    <motion.div
      className="absolute inset-0"
      style={reducedMotion ? { opacity: index === 0 ? 1 : 0 } : { opacity }}
      aria-hidden={index !== 0}
    >
      <motion.div className="relative h-full w-full" style={reducedMotion ? undefined : { scale }}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="50vw"
          placeholder="blur"
          blurDataURL={image.blurDataURL}
          className="object-cover"
        />
        {/* The palette wins over the photography, not the other way round. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-champagne opacity-[0.08] mix-blend-multiply"
        />
      </motion.div>
    </motion.div>
  );
}

function ServiceBlock({ service, index }: { service: Service; index: number }) {
  return (
    <div>
      <div className="hairline-b flex items-baseline gap-6 pb-4">
        <span className="eyebrow tnum">{String(index + 1).padStart(2, "0")}</span>
        <span className="eyebrow text-ash">{service.duration}</span>
      </div>

      <h3 className="t-sub opsz-display mt-8">
        <Link href={`/services/${service.slug}`} className="link-draw">
          {service.name}
        </Link>
      </h3>

      {/* Kept below the service name at small sizes so the hierarchy holds. */}
      <p className="mt-5 max-w-xl font-display text-[1.0625rem] leading-[1.3] tracking-[-0.03em] text-clay-deep md:text-[1.35rem] md:leading-[1.25]">
        {service.promise}
      </p>

      <p className="mt-6 max-w-xl">{service.description}</p>

      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
        <span className="text-[0.9375rem] text-ink">
          from <span className="tnum">{formatAed(service.priceFrom)}</span>
        </span>
        <a
          href={whatsappLink(enquiryMessage(service.shortName))}
          target="_blank"
          rel="noopener noreferrer"
          className="link-draw text-[0.9375rem] text-clay-deep"
        >
          {SERVICES_SECTION.enquire}
          <span className="sr-only"> about {service.name}</span>
        </a>
        <Link
          href={`/services/${service.slug}`}
          className="link-draw text-[0.9375rem] text-ash"
        >
          Read more
          <span className="sr-only"> about {service.name}</span>
        </Link>
      </div>
    </div>
  );
}
