"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { getImage, type ImageSlot } from "@/content/images";

type ParallaxImageProps = {
  slot: ImageSlot;
  className?: string;
  /** Effective scroll speed. 0.85 means the image trails the page slightly. */
  speed?: number;
  sizes?: string;
  priority?: boolean;
  /** Overrides the manifest alt when the same photo is reused in context. */
  alt?: string;
};

/**
 * Editorial image with a vertical parallax drift. The inner layer is oversized
 * so the frame never reveals an edge at either end of the travel.
 */
export function ParallaxImage({
  slot,
  className,
  speed = 0.85,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  priority = false,
  alt,
}: ParallaxImageProps) {
  const image = getImage(slot);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useSafeReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const drift = (1 - speed) * 100;
  const y = useTransform(scrollYProgress, [0, 1], [`${-drift}%`, `${drift}%`]);

  return (
    <div ref={ref} className={`relative overflow-hidden bg-champagne/30 ${className ?? ""}`}>
      <motion.div
        className="absolute inset-0 -top-[8%] -bottom-[8%]"
        style={reducedMotion ? undefined : { y }}
      >
        <Image
          src={image.src}
          alt={alt ?? image.alt}
          fill
          sizes={sizes}
          priority={priority}
          placeholder="blur"
          blurDataURL={image.blurDataURL}
          className="object-cover"
        />
      </motion.div>
    </div>
  );
}
