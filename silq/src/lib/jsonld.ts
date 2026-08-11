import { AREAS } from "@/content/areas";
import { FAQS, type FaqItem } from "@/content/faq";
import { PRICE_GROUPS } from "@/content/pricing";
import { SERVICES, type Service } from "@/content/services";
import { SITE, SITE_URL, WHATSAPP_NUMBER } from "@/content/site";

const ORG_ID = `${SITE_URL}/#hairsalon`;

/**
 * HairSalon is a LocalBusiness subtype. areaServed is generated from the same
 * list the coverage section renders, so the two can never drift apart.
 */
export function hairSalonSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": ORG_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    description: SITE.longDescription,
    url: SITE_URL,
    telephone: `+${WHATSAPP_NUMBER}`,
    image: `${SITE_URL}/images/og-image.jpg`,
    priceRange: "AED 40 – AED 1,200+",
    currenciesAccepted: "AED",
    paymentAccepted: "Cash, Credit Card, Bank Transfer",
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.city,
      addressCountry: "AE",
    },
    sameAs: [SITE.instagram.url],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: SITE.hours.opens,
        closes: SITE.hours.closes,
      },
    ],
    areaServed: AREAS.map((area) => ({
      "@type": "Place",
      name: `${area}, ${SITE.city}`,
    })),
    makesOffer: SERVICES.map((service) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: service.name,
        url: `${SITE_URL}/services/${service.slug}`,
      },
      priceSpecification: {
        "@type": "PriceSpecification",
        price: service.priceFrom,
        priceCurrency: "AED",
        valueAddedTaxIncluded: true,
        description: "Starting price. Final price depends on length, density and current colour.",
      },
    })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Price list",
      itemListElement: PRICE_GROUPS.map((group) => ({
        "@type": "OfferCatalog",
        name: group.title,
        itemListElement: group.rows.map((row) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: row.name },
          price: row.from,
          priceCurrency: "AED",
        })),
      })),
    },
  };
}

export function faqPageSchema(items: FaqItem[] = FAQS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function serviceSchema(service: Service) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    serviceType: service.name,
    description: service.page.description,
    url: `${SITE_URL}/services/${service.slug}`,
    provider: { "@id": ORG_ID },
    areaServed: AREAS.map((area) => ({
      "@type": "Place",
      name: `${area}, ${SITE.city}`,
    })),
    offers: {
      "@type": "Offer",
      price: service.priceFrom,
      priceCurrency: "AED",
      availability: "https://schema.org/InStock",
      description: "Starting price. Confirmed before the appointment begins.",
    },
  };
}

export function breadcrumbSchema(service: Service) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: service.name,
        item: `${SITE_URL}/services/${service.slug}`,
      },
    ],
  };
}

/** Serialises a schema object for a <script type="application/ld+json"> tag. */
export const jsonLd = (schema: object) => ({
  __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
});
