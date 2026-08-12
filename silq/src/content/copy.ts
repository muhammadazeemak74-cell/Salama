import { SITE } from "./site";

export const NAV_LINKS = [
  { label: "Services", href: "/#services" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Work", href: "/#transformations" },
  { label: "Areas", href: "/#coverage" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const HERO = {
  eyebrow: "Dubai · At-home hair studio",
  /** Split on spaces for the staggered word reveal. */
  heading: SITE.tagline,
  sub: "Colour, keratin and styling by senior stylists — at home, across Dubai.",
  primaryCta: "Book on WhatsApp",
  secondaryCta: "See services",
  scrollCue: "Scroll",
} as const;

export const INTRO = {
  eyebrow: "The difference",
  lines: [
    "We don't do nails.",
    "We don't do facials.",
    "We do hair — properly.",
  ],
  body: [
    "Every other at-home service in this city is a marketplace: a beautician arrives, does a bit of everything, and leaves. That model works for a manicure. It does not work for a colour correction.",
    "SILQ is a colour studio that travels. Senior stylists, professional product, a full salon setup carried to your door — and one discipline practised properly rather than six practised adequately.",
  ],
} as const;

export const SERVICES_SECTION = {
  eyebrow: "Services",
  heading: "One discipline, done completely.",
  intro:
    "Eight services, each priced from a starting point and confirmed before we begin. Brow threading is the only thing on this list that is not hair, and it is here because you asked.",
  enquire: "Enquire",
} as const;

export const HOW_IT_WORKS = {
  eyebrow: "How it works",
  heading: "Four steps, no surprises.",
  steps: [
    {
      number: "01",
      title: "Message",
      body: "Send a WhatsApp with what you want and a daylight photo of your hair. No forms, no call-back queue, no deposit to hold a slot.",
    },
    {
      number: "02",
      title: "Consult",
      body: "A stylist reads the photo and tells you what is achievable, how long it takes and what it costs. If a result needs two visits, you hear that now rather than mid-appointment.",
    },
    {
      number: "03",
      title: "We arrive",
      body: "We bring everything: chair cover, rolling trolley, basin attachment that fits a normal tap, professional dryers, irons and product. Floors and surfaces are covered before anything is opened. You need a chair, a socket and a tap.",
    },
    {
      number: "04",
      title: "You're done",
      body: "We confirm the price before we start and never after. When we finish, hair is swept, sheeting is folded, waste leaves with us, and your bathroom looks the way it did when we arrived.",
    },
  ],
} as const;

export const TRANSFORMATIONS = {
  eyebrow: "Work",
  heading: "Transformations.",
  intro: "Colour, correction and smoothing, photographed in ordinary light.",
  /** TODO(owner): Replace the gallery placeholders with your own client photos. */
  note: "Scroll to move through the gallery",
} as const;

export const COVERAGE = {
  eyebrow: "Coverage",
  heading: "Where we work.",
  note: "Outside these areas? Message us — we usually can.",
} as const;

export const PRICING_SECTION = {
  eyebrow: "Pricing",
  heading: "Starting from.",
  disclaimer:
    "Final pricing depends on hair length, density and current colour. We confirm the exact price before we start — never after.",
} as const;

export const TESTIMONIALS_SECTION = {
  eyebrow: "Clients",
  heading: "In their words.",
} as const;

export const FAQ_SECTION = {
  eyebrow: "Questions",
  heading: "Before you book.",
} as const;

export const BOOKING = {
  eyebrow: "Booking",
  heading: "Build your appointment.",
  intro:
    "Five short steps. It writes the WhatsApp message for you — nothing is stored and nothing is sent until you press send.",
  escapeHatch: "Or skip the form and message us directly.",
  steps: ["Service", "Hair length", "When", "Area", "Name"],
  submit: "Open WhatsApp",
  back: "Back",
  next: "Continue",
} as const;

export const FOOTER = {
  blurb: "A hair specialist working across Dubai. Colour, keratin, treatments and styling, at home.",
  columns: {
    services: "Services",
    company: "Studio",
  },
  legal: [
    `${SITE.legalName}, Dubai, ${SITE.country}`,
    SITE.tradeLicence,
  ],
  disclaimer:
    "SILQ is a mobile hair service. We are not a salon premises and do not offer nail, facial or massage treatments.",
} as const;

export const HAIR_LENGTHS = [
  "Above the shoulder",
  "Shoulder length",
  "Mid-back",
  "Waist or longer",
] as const;

export const TIME_PREFERENCES = [
  "Weekday morning",
  "Weekday afternoon",
  "Weekday evening",
  "Weekend",
  "As soon as possible",
] as const;
