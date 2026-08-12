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

export type TrustStat = {
  /**
   * null means "we cannot evidence this yet" and the stat is not rendered.
   * REAL FIGURES ONLY. A fabricated review score or client count is a legal
   * exposure for a UAE trade-licensed business — the UAE Consumer Protection
   * Law and Google's review policies both treat invented ratings as
   * misrepresentation, and a trade licence makes the trader personally
   * accountable for it. An empty trust bar costs nothing; an invented one can
   * cost the licence. Fill these in only from records you could produce on
   * request.
   */
  value: number | null;
  suffix?: string;
  decimals?: number;
  label: string;
};

/**
 * The trust bar renders only the stats that have a value, and disappears
 * entirely when none do. Populate them as the evidence exists — there is no
 * need to wait for all four.
 *
 * "Areas covered" is the one that is safe to switch on immediately: it is
 * simply AREAS.length from src/content/areas.ts, so it is verifiable by
 * inspection rather than a claim about the business.
 */
export const TRUST_STATS: TrustStat[] = [
  { value: null, label: "Years behind the chair" },
  { value: null, suffix: "+", label: "Appointments at home" },
  { value: null, label: "Dubai areas covered" },
  { value: null, decimals: 1, label: "Average client rating" },
];
