/**
 * Nova Path Explorer — single source of truth for all site copy and structure.
 *
 * Site language is SPANISH. This file is deliberately shaped so a future
 * English (or other) translation can be layered without touching components:
 * every user-facing string lives here in a typed object. To add a locale,
 * duplicate the exported `content` object into `content.en.ts` with the same
 * shape and select by locale at the page boundary.
 *
 * `imageSlot` values are the ONLY link between copy and photography — the
 * actual image URLs are resolved server-side in `src/lib/unsplash.ts`, keyed
 * by these slot names (see `src/data/images.ts`).
 */

export type ImageSlot =
  | "hero"
  | "aboutPrimary"
  | "aboutSecondary"
  | "airport"
  | "cityTour"
  | "abuDhabi"
  | "desert"
  | "yacht"
  | "photography"
  | "concierge"
  | "custom"
  | "testimonial";

export type WaypointKind =
  | "arch"
  | "tower"
  | "dome"
  | "dune"
  | "sail"
  | "camera"
  | "pin";

export type GroupSize = "1–4 personas" | "1–6 personas" | "1–10 personas";

export interface Experience {
  slug: string;
  title: string;
  groupSize: GroupSize;
  description: string;
  highlights: string[];
  imageSlot: ImageSlot;
}

export interface Pillar {
  title: string;
  description: string;
  icon: "user-round" | "gem" | "map-pin" | "shield-check";
}

export interface IncludedItem {
  title: string;
  description: string;
  icon: "car-front" | "compass" | "droplets" | "sparkles";
}

export interface Step {
  number: string;
  title: string;
  description: string;
  icon: "message-circle" | "route" | "palmtree";
}

export interface Testimonial {
  quote: string;
  author: string;
  origin: string;
}

const whatsappNumber = "971583059479";
const whatsappMessage =
  "Hola Nova Path Explorer 👋 Me gustaría reservar una experiencia privada en Dubái. ¿Me pueden ayudar?";

export const site = {
  name: "Nova Path Explorer",
  logoLockup: { first: "Nova Path", second: "EXPLORER" },
  tagline: "Vive Dubái de una forma diferente.",
  metaDescription:
    "Experiencias privadas y travel concierge en Emiratos Árabes Unidos para viajeros de habla hispana. Traslados, city tours, desierto, yates y más — con acompañamiento personalizado.",
  whatsappNumber,
  whatsappLink: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    whatsappMessage
  )}`,
  instagram: {
    handle: "@novapathexplorer",
    // TODO: reemplazar por el enlace real de Instagram del cliente.
    url: "https://instagram.com/",
  },
  // TODO: reemplazar por el correo real del cliente.
  email: "hola@novapathexplorer.com",
  location: "Dubái · Emiratos Árabes Unidos",
} as const;

export const nav = [
  { label: "Nosotros", href: "#nosotros" },
  { label: "Experiencias", href: "#experiencias" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Contacto", href: "#contacto" },
] as const;

export const hero = {
  eyebrow: "Travel concierge privado · Dubái · EAU",
  headline: "Vive Dubái de una forma diferente.",
  subline:
    "Experiencias privadas y acompañamiento a medida en los Emiratos, pensadas para viajeros de habla hispana. Nosotros nos ocupamos de cada detalle; tú solo disfruta el viaje.",
  primaryCta: "Reservar por WhatsApp",
  secondaryCta: "Ver experiencias",
} as const;

/**
 * Cinematic film chapters that sit between the editorial sections. Each maps to
 * a scrubbed footage clip (public/footage/scene-N.mp4) with a graceful Unsplash
 * still fallback keyed by `imageSlot`.
 */
export const filmChapters = {
  hero: { scene: "scene-1", imageSlot: "hero" as ImageSlot, alt: "Dubái desde el aire" },
  desert: {
    scene: "scene-2",
    imageSlot: "desert" as ImageSlot,
    alt: "Dunas del desierto de Dubái",
    kicker: "Experiencias",
    title: "El desierto te espera.",
    subtitle:
      "Dunas doradas, un té al atardecer y una noche bajo las estrellas — a solo unos minutos de la ciudad.",
  },
  marina: {
    scene: "scene-3",
    imageSlot: "yacht" as ImageSlot,
    alt: "Marina de Dubái y yates",
    kicker: "A tu medida",
    title: "El mar, a tu ritmo.",
    subtitle:
      "Marina, yates privados y planes que diseñamos contigo, para vivir Dubái sin prisas.",
  },
  arrival: {
    scene: "scene-4",
    imageSlot: "cityTour" as ImageSlot,
    alt: "Un ícono de Dubái de noche",
    kicker: "Tu llegada",
    title: "Bienvenido a Dubái.",
    subtitle:
      "Desde el aterrizaje hasta el último atardecer, estamos a tu lado en cada paso.",
  },
} as const;

export const about = {
  eyebrow: "Quiénes somos",
  title: "Un anfitrión local para tu viaje a los Emiratos.",
  body: "Nova Path Explorer diseña experiencias privadas y ofrece travel concierge en los Emiratos Árabes Unidos. Te acompañamos antes, durante y después del viaje: planificamos contigo, estamos a tu lado sobre el terreno y seguimos disponibles cuando lo necesitas. Todo en español, con la cercanía de quien conoce Dubái como su casa.",
  pillars: [
    {
      title: "Servicio personalizado",
      description:
        "Cada itinerario se adapta a tu ritmo, tus tiempos y lo que de verdad quieres ver.",
      icon: "user-round",
    },
    {
      title: "Experiencias privadas",
      description:
        "Sin grupos multitudinarios: solo tú y quienes viajan contigo.",
      icon: "gem",
    },
    {
      title: "Conocimiento local",
      description:
        "Los mejores momentos, rutas y rincones, elegidos por quien vive aquí.",
      icon: "map-pin",
    },
    {
      title: "Confianza y profesionalismo",
      description:
        "Puntualidad, atención cuidada y comunicación clara de principio a fin.",
      icon: "shield-check",
    },
  ] satisfies Pillar[],
} as const;

export const experiences = {
  eyebrow: "Experiencias",
  title: "Diseñadas para vivir los Emiratos sin prisas.",
  subtitle:
    "Ocho maneras de descubrir Dubái y Abu Dhabi. ¿No encuentras exactamente lo que buscas? Lo creamos a tu medida.",
  items: [
    {
      slug: "traslados-aeropuerto",
      title: "Traslados de Aeropuerto",
      groupSize: "1–6 personas",
      description:
        "Recepción meet & greet en el aeropuerto de Dubái (DXB) y traslado privado a tu hotel. Llegas y ya hay alguien esperándote.",
      highlights: ["DXB · Meet & greet", "Traslado privado", "Asistencia en español"],
      imageSlot: "airport",
    },
    {
      slug: "dubai-city-tour",
      title: "Dubai City Tour",
      groupSize: "1–6 personas",
      description:
        "Un recorrido por los iconos de la ciudad, a tu ritmo y con las mejores fotos garantizadas.",
      highlights: [
        "Dubai Frame",
        "Museum of the Future",
        "Marina · Bluewaters · Kite Beach",
      ],
      imageSlot: "cityTour",
    },
    {
      slug: "abu-dhabi-experience",
      title: "Abu Dhabi Experience",
      groupSize: "1–6 personas",
      description:
        "Una jornada por la capital: cultura, arte y palacios en un día inolvidable.",
      highlights: [
        "Mezquita Sheikh Zayed",
        "Louvre Abu Dhabi",
        "Qasr Al Watan · Emirates Palace",
      ],
      imageSlot: "abuDhabi",
    },
    {
      slug: "desert-safari",
      title: "Desert Safari",
      groupSize: "1–6 personas",
      description:
        "El desierto al atardecer: adrenalina sobre las dunas y una noche bajo las estrellas.",
      highlights: [
        "Dunas en 4x4",
        "Camellos · atardecer",
        "Fogata y shows en vivo",
      ],
      imageSlot: "desert",
    },
    {
      slug: "yacht-experience",
      title: "Yacht Experience",
      groupSize: "1–10 personas",
      description:
        "Navega frente al Atlantis y Palm Jumeirah en un yate privado, de 1 a 10 personas.",
      highlights: ["Yate privado", "Atlantis · Palm Jumeirah", "1 a 10 personas"],
      imageSlot: "yacht",
    },
    {
      slug: "photography-experience",
      title: "Photography Experience",
      groupSize: "1–4 personas",
      description:
        "Una sesión en los rincones más fotogénicos de Dubái, aprovechando la luz de la golden hour.",
      highlights: ["Golden hour", "Spots icónicos", "Recuerdos de verdad"],
      imageSlot: "photography",
    },
    {
      slug: "travel-concierge",
      title: "Travel Concierge",
      groupSize: "1–6 personas",
      description:
        "Nos ocupamos de la logística de tu viaje: reservas, planificación y recomendaciones locales.",
      highlights: ["Reservas", "Planificación", "Recomendaciones locales"],
      imageSlot: "concierge",
    },
    {
      slug: "experiencias-a-medida",
      title: "Experiencias a medida",
      groupSize: "1–6 personas",
      description:
        "¿Tienes algo concreto en mente? Diseñamos una experiencia única a partir de tu idea.",
      highlights: ["Hecho a tu medida", "Flexible", "Sin plantillas"],
      imageSlot: "custom",
    },
  ] satisfies Experience[],
} as const;

export const included = {
  eyebrow: "Incluido en cada experiencia",
  title: "Lo esencial, siempre resuelto.",
  items: [
    {
      title: "Transporte privado",
      description: "Vehículo cómodo y climatizado, solo para tu grupo.",
      icon: "car-front",
    },
    {
      title: "Asesoría y acompañamiento",
      description: "Alguien atento a cada detalle, del primer mensaje al regreso.",
      icon: "compass",
    },
    {
      title: "Agua incluida",
      description: "Agua fresca a bordo durante todo el recorrido.",
      icon: "droplets",
    },
    {
      title: "Flexibilidad y comodidad",
      description: "Adaptamos horarios y ritmo a como quieras vivir el día.",
      icon: "sparkles",
    },
  ] satisfies IncludedItem[],
} as const;

export const howItWorks = {
  eyebrow: "Cómo funciona",
  title: "Reservar es tan sencillo como escribir un mensaje.",
  steps: [
    {
      number: "01",
      title: "Escríbenos por WhatsApp",
      description:
        "Cuéntanos qué te gustaría vivir, cuándo viajas y con cuántas personas.",
      icon: "message-circle",
    },
    {
      number: "02",
      title: "Diseñamos tu experiencia",
      description:
        "Preparamos una propuesta a tu medida y afinamos cada detalle contigo.",
      icon: "route",
    },
    {
      number: "03",
      title: "Vive Dubái sin preocupaciones",
      description:
        "Nosotros nos encargamos de todo. Tú solo disfruta del viaje.",
      icon: "palmtree",
    },
  ] satisfies Step[],
} as const;

export const testimonials = {
  eyebrow: "Testimonios",
  title: "Lo que cuentan quienes ya viajaron con nosotros.",
  // TODO: reemplazar por testimonios reales de clientes con su permiso.
  items: [
    {
      quote:
        "Todo estuvo cuidado hasta el último detalle. Nos sentimos acompañados en cada momento y pudimos disfrutar sin pensar en la logística.",
      author: "Testimonio pendiente",
      origin: "Madrid, España",
    },
    {
      quote:
        "El safari al atardecer fue mágico y el trato, cercano y en español. Repetiríamos sin dudarlo.",
      author: "Testimonio pendiente",
      origin: "Ciudad de México",
    },
    {
      quote:
        "Nos organizaron el viaje completo por WhatsApp. Profesionalismo y confianza de principio a fin.",
      author: "Testimonio pendiente",
      origin: "Bogotá, Colombia",
    },
  ] satisfies Testimonial[],
} as const;

export const contact = {
  eyebrow: "Contacto",
  title: "¿Listo para vivir Dubái de otra forma?",
  body: "Escríbenos por WhatsApp y empecemos a diseñar tu experiencia. Respondemos en español, siempre.",
  cta: "Reservar por WhatsApp",
} as const;
