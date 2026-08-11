import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SERVICES, getService } from "@/content/services";
import { SITE_URL } from "@/content/site";
import { formatAed } from "@/content/pricing";
import { AREAS } from "@/content/areas";
import { enquiryMessage, whatsappLink } from "@/lib/whatsapp";
import {
  breadcrumbSchema,
  faqPageSchema,
  jsonLd,
  serviceSchema,
} from "@/lib/jsonld";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { RevealBlock, RevealText } from "@/components/motion/RevealText";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Faq } from "@/components/sections/Faq";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};

  const url = `${SITE_URL}/services/${service.slug}`;

  return {
    title: service.page.title,
    description: service.page.description,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      type: "article",
      url,
      title: service.page.title,
      description: service.page.description,
      images: [{ url: `/images/${service.image}.jpg`, alt: service.page.h1 }],
    },
    twitter: {
      card: "summary_large_image",
      title: service.page.title,
      description: service.page.description,
      images: [`/images/${service.image}.jpg`],
    },
  };
}

export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const others = SERVICES.filter((item) => item.slug !== service.slug).slice(0, 4);
  const enquire = whatsappLink(enquiryMessage(service.shortName));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(serviceSchema(service))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqPageSchema(service.page.faqs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbSchema(service))}
      />

      {/* ---------- Masthead ---------- */}
      <header className="shell pb-16 pt-36 lg:pb-24 lg:pt-48">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.24em] text-ash">
            <li>
              <Link href="/" className="link-draw hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/#services" className="link-draw hover:text-ink">
                Services
              </Link>
            </li>
          </ol>
        </nav>

        <RevealText
          as="h1"
          lines={[service.page.h1]}
          className="t-display opsz-display mt-10 max-w-[16ch]"
        />

        <RevealBlock delay={0.1}>
          <p className="t-lead mt-8 max-w-2xl">{service.page.lede}</p>
        </RevealBlock>

        <RevealBlock delay={0.16}>
          {/* The CTA sits beside the list, not inside it — a <dl> may only
              contain dt/dd groups. */}
          <div className="hairline mt-14 flex flex-wrap items-end gap-x-16 gap-y-6 pt-8">
            <dl className="flex flex-wrap gap-x-16 gap-y-6">
              <div>
                <dt className="eyebrow">From</dt>
                <dd className="tnum mt-2 font-display text-[1.75rem] font-light tracking-[-0.03em] text-ink">
                  {formatAed(service.priceFrom)}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Typical duration</dt>
                <dd className="mt-2 font-display text-[1.75rem] font-light tracking-[-0.03em] text-ink">
                  {service.duration}
                </dd>
              </div>
            </dl>
            <MagneticButton
              href={enquire}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Enquire on WhatsApp
            </MagneticButton>
          </div>
        </RevealBlock>
      </header>

      {/* ---------- Editorial image ---------- */}
      <div className="shell">
        <ParallaxImage
          slot={service.image}
          className="aspect-[16/10] w-full lg:aspect-[21/9]"
          sizes="100vw"
          priority
        />
      </div>

      {/* ---------- Body ---------- */}
      <article className="shell py-24 lg:py-36">
        <p className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-light leading-[1.2] tracking-[-0.035em] text-ink">
          {service.promise}
        </p>
        <p className="t-lead mt-8 max-w-2xl">{service.description}</p>

        {service.page.sections.map((section, index) => (
          <section key={section.heading} className="mt-20 lg:mt-28 lg:grid lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <RevealText
                as="h2"
                lines={[section.heading]}
                className="t-sub opsz-display lg:sticky lg:top-32"
                delay={index * 0.02}
              />
            </div>
            <div className="mt-8 max-w-2xl space-y-6 lg:col-span-8 lg:mt-0">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <RevealBlock key={paragraph} delay={paragraphIndex * 0.05}>
                  <p className="t-lead">{paragraph}</p>
                </RevealBlock>
              ))}
            </div>
          </section>
        ))}

        <RevealBlock>
          <section className="hairline mt-24 pt-10 lg:mt-32">
            <h2 className="eyebrow">Where we come to you</h2>
            <p className="mt-6 max-w-3xl">
              {service.name} is available at home across {AREAS.slice(0, -1).join(", ")} and{" "}
              {AREAS[AREAS.length - 1]}. Outside these areas, message us — we usually can.
            </p>
          </section>
        </RevealBlock>
      </article>

      {/* ---------- FAQ ---------- */}
      <Faq items={service.page.faqs} id={`faq-${service.slug}`} />

      {/* ---------- CTA ---------- */}
      <section className="on-dark">
        <div className="shell py-24 lg:py-32">
          <div className="lg:flex lg:items-end lg:justify-between lg:gap-16">
            <div>
              <p className="eyebrow">Booking</p>
              <RevealText
                as="h2"
                lines={["Send a photo.", "We'll tell you what's possible."]}
                className="t-section opsz-display mt-6"
                delay={0.05}
              />
            </div>
            <div className="mt-10 flex flex-wrap gap-4 lg:mt-0 lg:shrink-0">
              <MagneticButton
                href={enquire}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Enquire on WhatsApp
              </MagneticButton>
              <Link href="/#booking" className="btn btn-ghost">
                Build an appointment
              </Link>
            </div>
          </div>

          <nav aria-label="Other services" className="hairline mt-20 pt-10">
            <h2 className="eyebrow">Also at home</h2>
            <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/services/${item.slug}`}
                    className="link-draw font-display text-[1.25rem] font-light leading-tight tracking-[-0.03em] text-bone"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </>
  );
}
