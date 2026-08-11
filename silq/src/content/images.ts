import { IMAGE_BLUR } from "./image-blur";

/**
 * Typed manifest of every image the site uses.
 *
 * Nothing here points at a third-party URL. Each slot maps to a local file at
 * /public/images/<slot>.jpg. Run `npm run placeholders` to generate an elegant
 * gradient stand-in at the correct dimensions for every slot, so the site builds
 * and reads as intentional before a single real photograph exists.
 *
 * To drop in a real photo: replace /public/images/<slot>.jpg with a file of the
 * same dimensions and re-run `npm run placeholders` to refresh the blur data.
 * See IMAGE-BRIEF.md at the repo root for the shot list and search terms.
 */

export type ImageSlot =
  | "hero"
  | "intro-editorial"
  | "booking-block"
  | "og-image"
  | "service-cutting"
  | "service-colouring"
  | "service-balayage"
  | "service-treatments"
  | "service-keratin"
  | "service-botox"
  | "service-styling"
  | "service-threading"
  | "gallery-01"
  | "gallery-02"
  | "gallery-03"
  | "gallery-04"
  | "gallery-05"
  | "gallery-06"
  | "gallery-07"
  | "gallery-08"
  | "gallery-09"
  | "gallery-10";

export type ImageSpec = {
  /** Required source dimensions. The placeholder generator writes exactly these. */
  width: number;
  height: number;
  /** Alt text. Written to describe the subject, never "image of". */
  alt: string;
  /** Suggested search query, mirrored into IMAGE-BRIEF.md. */
  query: string;
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
    alt: "A stylist finishing a glossy blow-dry in a sunlit Dubai apartment",
    query: "glossy brunette blow dry natural light interior",
  },
  "intro-editorial": {
    width: 1600,
    height: 1200,
    alt: "Professional colour bowls, brushes and foils laid out on a trolley",
    query: "hair colour bowl brush foils flat lay salon trolley",
  },
  "booking-block": {
    width: 1800,
    height: 1200,
    alt: "A portable styling setup arranged in a client's living room",
    query: "portable salon chair setup home living room styling",
  },
  "og-image": {
    width: 1200,
    height: 630,
    alt: "SILQ — the studio comes to you",
    query: "editorial hair portrait warm neutral tones landscape crop",
  },

  "service-cutting": {
    width: 1400,
    height: 1750,
    alt: "A precision cut being checked dry through the ends",
    query: "hair cutting scissors precision bob salon portrait",
  },
  "service-colouring": {
    width: 1400,
    height: 1750,
    alt: "Colour being applied section by section at the root",
    query: "hair colour application root brush section salon",
  },
  "service-balayage": {
    width: 1400,
    height: 1750,
    alt: "Freehand balayage seen from behind, brightest through the mid-lengths",
    query: "balayage hair back view salon",
  },
  "service-treatments": {
    width: 1400,
    height: 1750,
    alt: "A deep conditioning mask worked through wet mid-lengths",
    query: "hair mask treatment wet hair conditioning salon",
  },
  "service-keratin": {
    width: 1400,
    height: 1750,
    alt: "Smooth, high-shine straight hair after a keratin treatment",
    query: "smooth glossy straight hair studio",
  },
  "service-botox": {
    width: 1400,
    height: 1750,
    alt: "Glossy defined curls after a deep conditioning treatment",
    query: "shiny defined curls healthy hair portrait",
  },
  "service-styling": {
    width: 1400,
    height: 1750,
    alt: "A pinned occasion updo finished with soft waves at the front",
    query: "elegant updo chignon occasion hair back view",
  },
  "service-threading": {
    width: 1400,
    height: 1750,
    alt: "Brow shaping with cotton thread, close up",
    query: "eyebrow threading close up",
  },

  "gallery-01": {
    width: 1200,
    height: 1600,
    alt: "Before and after: warm brunette lifted to a soft bronde balayage",
    query: "before after balayage brunette transformation",
  },
  "gallery-02": {
    width: 1600,
    height: 1200,
    alt: "Frizzy mid-lengths smoothed after a keratin treatment",
    query: "keratin before after frizz smooth hair",
  },
  "gallery-03": {
    width: 1400,
    height: 1400,
    alt: "Fine babylights woven through a dark base",
    query: "babylights fine highlights dark hair",
  },
  "gallery-04": {
    width: 1100,
    height: 1650,
    alt: "A blunt French bob cut to the jaw",
    query: "french bob blunt haircut portrait",
  },
  "gallery-05": {
    width: 1800,
    height: 1200,
    alt: "Old-Hollywood waves set and brushed out",
    query: "retro hollywood waves hair styling",
  },
  "gallery-06": {
    width: 1200,
    height: 1500,
    alt: "Grey coverage with a reflective tone through the crown",
    query: "grey coverage rich brunette hair colour",
  },
  "gallery-07": {
    width: 1500,
    height: 1000,
    alt: "A bridal updo pinned low with a veil comb",
    query: "bridal updo low chignon veil",
  },
  "gallery-08": {
    width: 1300,
    height: 1625,
    alt: "Copper ombré graduating through the lengths",
    query: "copper ombre hair colour long",
  },
  "gallery-09": {
    width: 1400,
    height: 1050,
    alt: "Curls restored and defined after a bond repair treatment",
    query: "curly hair bond repair before after",
  },
  "gallery-10": {
    width: 1200,
    height: 1800,
    alt: "A long layered cut with face-framing brightness",
    query: "long layers face framing highlights",
  },
};

export const IMAGE_SLOTS = Object.keys(IMAGE_MANIFEST) as ImageSlot[];

export const GALLERY_SLOTS: ImageSlot[] = IMAGE_SLOTS.filter((slot) =>
  slot.startsWith("gallery-"),
);

/** Resolves a slot to everything next/image needs. */
export function getImage(slot: ImageSlot): ImageAsset {
  return {
    slot,
    src: `/images/${slot}.jpg`,
    blurDataURL: IMAGE_BLUR[slot],
    ...IMAGE_MANIFEST[slot],
  };
}
