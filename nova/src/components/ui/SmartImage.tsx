import Image from "next/image";
import type { ImageSlot } from "@/data/content";
import type { ResolvedImage } from "@/lib/unsplash";
import { gradientFallback } from "@/data/images";

/**
 * Renders a resolved Unsplash photo, or — when the key is missing or a fetch
 * failed — a tasteful brand-gradient panel. Never a broken image.
 */
export function SmartImage({
  image,
  slot,
  alt,
  sizes,
  priority,
  className = "",
}: {
  image: ResolvedImage | null;
  slot: ImageSlot;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={`h-full w-full ${className}`}
        style={{ backgroundImage: gradientFallback[slot] }}
        aria-hidden="true"
      />
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt || alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}
