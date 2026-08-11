/**
 * Dubai neighbourhoods we cover. This list feeds both the coverage section and
 * the `areaServed` array in the HairSalon structured data, so adding an area
 * here is all that is needed for it to be picked up by search engines.
 */
export const AREAS = [
  "Downtown Dubai",
  "Business Bay",
  "DIFC",
  "Jumeirah 1",
  "Jumeirah 2",
  "Jumeirah 3",
  "Umm Suqeim",
  "Al Barsha",
  "JLT",
  "JVC",
  "JVT",
  "Dubai Marina",
  "Palm Jumeirah",
  "Arabian Ranches",
  "Dubai Hills Estate",
  "Damac Hills",
  "Mirdif",
  "Dubai Silicon Oasis",
  "Al Furjan",
  "The Springs",
  "Motor City",
] as const;

export type Area = (typeof AREAS)[number];
