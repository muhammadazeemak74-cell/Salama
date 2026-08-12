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
 * Empty until a build has run with PEXELS_API_KEY set. Gradient placeholders
 * need no attribution — nobody owns them, and crediting a photographer for an
 * image that is not theirs is worse than crediting nobody.
 */
export const PHOTO_CREDITS: Partial<Record<ImageSlot, PhotoCredit>> = {};
