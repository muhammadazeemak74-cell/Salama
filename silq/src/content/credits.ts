// GENERATED FILE — do not edit by hand.
// Written by scripts/fetch-images.mjs. Powers the /credits page.
import type { ImageSlot } from "./images";

export type PhotoCredit = {
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
};

/**
 * Pexels does not require attribution but asks for it, so every photograph
 * still in use is credited on /credits.
 *
 * Empty until `npm run images` has run with a PEXELS_API_KEY. The slots are
 * currently filled by generated gradient placeholders, which nobody owns and
 * nothing needs crediting for.
 */
export const PHOTO_CREDITS: Partial<Record<ImageSlot, PhotoCredit>> = {};
