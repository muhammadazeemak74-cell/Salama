import type { ImageSlot } from "./content";

/**
 * The ONLY place image search queries live. Each content `imageSlot` maps to
 * an Unsplash search query; the URL is resolved server-side in
 * `src/lib/unsplash.ts`. Swap these for the client's own photography later —
 * TODO: replace with Nova Path Explorer's real shoot assets.
 */
export const imageQueries: Record<ImageSlot, string> = {
  hero: "Dubai skyline burj khalifa",
  aboutPrimary: "Dubai Marina night",
  aboutSecondary: "Dubai old town abra",
  airport: "chauffeur luggage airport",
  cityTour: "Dubai Frame",
  abuDhabi: "Sheikh Zayed Mosque",
  desert: "desert safari dunes Dubai",
  yacht: "yacht Dubai marina",
  photography: "photographer golden hour city",
  concierge: "Dubai luxury hotel lobby",
  custom: "Dubai palm jumeirah aerial",
  testimonial: "Dubai golden hour skyline",
};

/**
 * Tasteful brand-gradient fallbacks — used when the Unsplash key is missing
 * or a fetch fails, so a card never shows a broken image. Uses ONLY the brand
 * palette. Rotated per slot for gentle variety.
 */
export const gradientFallback: Record<ImageSlot, string> = {
  hero: "linear-gradient(135deg, #2f8ca3 0%, #14304a 60%, #f2a33c 140%)",
  aboutPrimary: "linear-gradient(140deg, #14304a 0%, #2f8ca3 100%)",
  aboutSecondary: "linear-gradient(140deg, #2f8ca3 0%, #f1e7d8 120%)",
  airport: "linear-gradient(150deg, #2b4b66 0%, #2f8ca3 100%)",
  cityTour: "linear-gradient(150deg, #2f8ca3 0%, #14304a 100%)",
  abuDhabi: "linear-gradient(150deg, #14304a 0%, #246f83 100%)",
  desert: "linear-gradient(150deg, #f2a33c 0%, #e08a1e 60%, #14304a 130%)",
  yacht: "linear-gradient(150deg, #2f8ca3 0%, #246f83 60%, #14304a 120%)",
  photography: "linear-gradient(150deg, #f2a33c 0%, #2f8ca3 120%)",
  concierge: "linear-gradient(150deg, #14304a 0%, #2b4b66 100%)",
  custom: "linear-gradient(150deg, #2f8ca3 0%, #f2a33c 130%)",
  testimonial: "linear-gradient(150deg, #14304a 0%, #2f8ca3 100%)",
};
