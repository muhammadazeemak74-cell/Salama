/**
 * Single source of truth for brand-level facts.
 * Everything an owner is likely to change lives in this folder, never in a component.
 */

/**
 * TODO(owner): Replace with the real WhatsApp business number.
 * Format: country code + number, digits only, no "+" and no spaces.
 * Example for a UAE mobile 050 123 4567 -> "971501234567".
 */
export const WHATSAPP_NUMBER = "971500000000";

/** TODO(owner): Replace with the number as you want it printed on the page. */
export const PHONE_DISPLAY = "+971 50 000 0000";

/** TODO(owner): Replace with the live domain once the site is pointed at it. */
export const SITE_URL = "https://silq.ae";

export const SITE = {
  name: "SILQ",
  legalName: "SILQ Hair Studio",
  tagline: "The studio comes to you.",
  shortDescription:
    "A hair specialist working across Dubai. Colour, keratin, treatments and styling, at home.",
  longDescription:
    "SILQ is a colour studio that travels. Senior stylists bring salon equipment, professional product and a full setup to your home anywhere in Dubai. Hair only — no nails, no facials.",
  city: "Dubai",
  country: "United Arab Emirates",
  /** TODO(owner): Replace with the real DED / trade licence number. */
  tradeLicence: "Trade Licence No. 000000",
  instagram: {
    handle: "@silq.ae",
    /** TODO(owner): Point at the real Instagram profile. */
    url: "https://instagram.com/silq.ae",
  },
  /**
   * TODO(owner): Confirm working hours before publishing — these feed the
   * structured data that Google reads.
   */
  hours: {
    label: "Daily, 9:00 – 21:00",
    opens: "09:00",
    closes: "21:00",
  },
} as const;

export const WHATSAPP_BASE = `https://wa.me/${WHATSAPP_NUMBER}`;
