/*
 * ---------------------------------------------------------------------------
 * THE 10 GALLERY SLOTS ARE STOCK PLACEHOLDERS.
 *
 * They MUST be replaced with real before/after client work before any paid
 * traffic is sent to this site. Stock transformation photos on a service
 * business are the fastest way to lose trust in this market.
 *
 * Replace by dropping files into /public/images/ with the same filenames —
 * gal-01.webp, gal-02.webp, and so on. No code change needed. Re-run
 * `npm run images:blur` afterwards to refresh the blur-up previews.
 * ---------------------------------------------------------------------------
 */

import { IMAGE_BLUR } from "./blur-data";

/**
 * Typed manifest of every image the site uses.
 *
 * Nothing here points at a third-party URL at runtime. Each slot maps to a
 * local file at /public/images/<slot>.webp, fetched and processed at build
 * time by `npm run images` (see scripts/fetch-images.mjs).
 *
 * `query` and `orientation` are the Pexels search parameters for that slot.
 * They are tuned for the bone/clay/champagne palette — edit with care, and
 * re-run with --force to re-fetch.
 */

export type ImageSlot =
  | "hero"
  | "intro-editorial"
  | "booking-block"
  | "og-image"
  | "svc-cutting"
  | "svc-colouring"
  | "svc-highlights"
  | "svc-treatment"
  | "svc-keratin"
  | "svc-botox-spa"
  | "svc-styling"
  | "svc-threading"
  | "gal-01"
  | "gal-02"
  | "gal-03"
  | "gal-04"
  | "gal-05"
  | "gal-06"
  | "gal-07"
  | "gal-08"
  | "gal-09"
  | "gal-10";

export type ImageSpec = {
  /** Exact output dimensions. Written by the fetch script with fit: cover. */
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
  /** Pexels search query. Empty when the slot is derived from another. */
  query: string;
  /**
   * Slot this one is cropped from instead of being searched separately.
   * Used for the OG card, which is the hero at a social aspect ratio.
   */
  derivedFrom?: ImageSlot;
  /** Alt text. Written to describe the subject, never "image of". */
  alt: string;
};

export type ImageAsset = ImageSpec & {
  slot: ImageSlot;
  src: string;
  blurDataURL: string;
};

export const IMAGE_MANIFEST: Record<ImageSlot, ImageSpec> = {
  hero: {
    width: 2400,
    height: 1600,
    orientation: "landscape",
    query: "woman long glossy brown hair back view",
    alt: "Long, glossy brown hair photographed from behind in soft daylight",
  },
  "intro-editorial": {
    width: 1600,
    height: 1200,
    orientation: "landscape",
    query: "hairdresser hands sectioning hair",
    alt: "A stylist's hands sectioning hair before colour is applied",
  },
  "booking-block": {
    width: 1800,
    height: 1200,
    orientation: "landscape",
    query: "beige minimal interior soft daylight",
    alt: "A quiet, warm-toned interior in soft daylight",
  },
  "og-image": {
    width: 1200,
    height: 630,
    orientation: "landscape",
    query: "",
    derivedFrom: "hero",
    alt: "SILQ — the studio comes to you",
  },

  "svc-cutting": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "hairdresser cutting long hair scissors",
    alt: "Long hair being cut with shears, held between the fingers",
  },
  "svc-colouring": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "hair colour application brush bowl salon",
    alt: "Colour being mixed in a bowl and applied with a tint brush",
  },
  "svc-highlights": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "balayage blonde hair back view",
    alt: "Freehand balayage seen from behind, brightest through the mid-lengths",
  },
  "svc-treatment": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "hair mask treatment application salon",
    alt: "A deep conditioning mask worked through wet mid-lengths",
  },
  "svc-keratin": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "straight glossy smooth brown hair",
    alt: "Smooth, high-shine straight hair after a keratin treatment",
  },
  "svc-botox-spa": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "hair wash basin scalp massage salon",
    alt: "A scalp massage at the basin during a hair spa treatment",
  },
  "svc-styling": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "elegant hair updo bridal styling",
    alt: "A pinned occasion updo finished with soft waves at the front",
  },
  "svc-threading": {
    width: 1400,
    height: 1750,
    orientation: "portrait",
    query: "eyebrow shaping close up beauty",
    alt: "Close-up of a brow being shaped",
  },

  "gal-01": {
    width: 1000,
    height: 1400,
    orientation: "portrait",
    query: "brunette balayage hair salon",
    alt: "Warm brunette lifted to a soft bronde balayage",
  },
  "gal-02": {
    width: 1400,
    height: 1000,
    orientation: "landscape",
    query: "blowout wavy hair styling",
    alt: "A soft blow-dry finished with a loose wave",
  },
  "gal-03": {
    width: 1000,
    height: 1400,
    orientation: "portrait",
    query: "caramel highlights long hair",
    alt: "Caramel highlights woven through long hair",
  },
  "gal-04": {
    width: 1000,
    height: 1400,
    orientation: "portrait",
    query: "sleek straight dark hair portrait",
    alt: "Sleek, straight dark hair with a high-shine finish",
  },
  "gal-05": {
    width: 1400,
    height: 1000,
    orientation: "landscape",
    query: "hair curling iron waves",
    alt: "Waves being set with a curling iron",
  },
  "gal-06": {
    width: 1000,
    height: 1400,
    orientation: "portrait",
    query: "ombre hair colour long",
    alt: "Ombré graduating through long lengths",
  },
  "gal-07": {
    width: 1000,
    height: 1400,
    orientation: "portrait",
    query: "bridal hair pinned updo detail",
    alt: "Detail of a bridal updo, pinned low",
  },
  "gal-08": {
    width: 1400,
    height: 1000,
    orientation: "landscape",
    query: "glossy healthy hair shine close up",
    alt: "Close-up of high-shine, healthy hair",
  },
  "gal-09": {
    width: 1000,
    height: 1400,
    orientation: "portrait",
    query: "short bob haircut styling",
    alt: "A short bob cut to the jaw",
  },
  "gal-10": {
    width: 1400,
    height: 1000,
    orientation: "landscape",
    query: "hair foils highlights process",
    alt: "Foils in place during a highlighting service",
  },
};

export const IMAGE_SLOTS = Object.keys(IMAGE_MANIFEST) as ImageSlot[];

export const GALLERY_SLOTS: ImageSlot[] = IMAGE_SLOTS.filter((slot) =>
  slot.startsWith("gal-"),
);

/** Resolves a slot to everything next/image needs. */
export function getImage(slot: ImageSlot): ImageAsset {
  return {
    slot,
    src: `/images/${slot}.webp`,
    blurDataURL: IMAGE_BLUR[slot],
    ...IMAGE_MANIFEST[slot],
  };
}
