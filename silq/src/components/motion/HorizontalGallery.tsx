"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { GALLERY_SLOTS, getImage } from "@/content/images";

/**
 * Pinned section that translates a row of photographs horizontally as the page
 * scrolls vertically. The section's own height is the measured track width, so
 * the row finishes exactly as the pin releases.
 *
 * Under reduced motion it becomes a normal horizontal scroller the user drags.
 */
export function HorizontalGallery({ label }: { label: string }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const reducedMotion = useSafeReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      // How far the row has to travel for its last image to reach the edge.
      setDistance(Math.max(0, track.scrollWidth - window.innerWidth));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [reducedMotion]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const rawX = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  // A light spring takes the edge off wheel jitter without adding lag.
  const x = useSpring(rawX, { stiffness: 220, damping: 40, mass: 0.6 });

  const images = GALLERY_SLOTS.map(getImage);

  if (reducedMotion) {
    return (
      <div className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 md:px-12">
        {images.map((image) => (
          <figure
            key={image.slot}
            className="relative h-[60vh] shrink-0 snap-center bg-champagne/30"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="60vh"
              placeholder="blur"
              blurDataURL={image.blurDataURL}
              className="object-cover"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-champagne opacity-[0.08] mix-blend-multiply"
            />
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div ref={sectionRef} style={{ height: `calc(100vh + ${distance}px)` }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex shrink-0 items-center gap-6 px-6 md:gap-10 md:px-12"
        >
          {images.map((image, index) => (
            <figure
              key={image.slot}
              data-cursor="view"
              className="relative h-[52vh] shrink-0 bg-champagne/30 md:h-[62vh]"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 70vw, 45vw"
                placeholder="blur"
                blurDataURL={image.blurDataURL}
                className="object-cover"
              />
              {/* The palette wins over the photography, not the other way round. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-champagne opacity-[0.08] mix-blend-multiply"
              />
              <figcaption className="pointer-events-none absolute -bottom-7 left-0 text-[0.6875rem] uppercase tracking-[0.24em] text-ash tnum">
                {String(index + 1).padStart(2, "0")}
              </figcaption>
            </figure>
          ))}
          <div
            aria-hidden
            className="flex h-[52vh] shrink-0 items-end pr-6 md:h-[62vh] md:pr-12"
          >
            <span className="whitespace-nowrap text-[0.6875rem] uppercase tracking-[0.24em] text-ash">
              {label}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
