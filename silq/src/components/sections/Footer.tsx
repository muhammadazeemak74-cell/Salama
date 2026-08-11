import Link from "next/link";
import { FOOTER, NAV_LINKS } from "@/content/copy";
import { SERVICES } from "@/content/services";
import { SITE, PHONE_DISPLAY } from "@/content/site";
import { GENERAL_ENQUIRY, whatsappLink } from "@/lib/whatsapp";
import { Wordmark } from "@/components/ui/Wordmark";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="on-dark">
      <div className="shell py-20 lg:py-24">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <Wordmark className="text-bone" />
            <p className="mt-6 max-w-xs text-[0.9375rem]">{FOOTER.blurb}</p>

            <div className="mt-8 flex flex-col gap-2">
              <a
                href={whatsappLink(GENERAL_ENQUIRY)}
                target="_blank"
                rel="noopener noreferrer"
                className="link-draw w-fit text-champagne"
              >
                WhatsApp {PHONE_DISPLAY}
              </a>
              <a
                href={SITE.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-draw w-fit text-champagne/75"
              >
                Instagram {SITE.instagram.handle}
              </a>
            </div>
          </div>

          <nav aria-label="Services" className="lg:col-span-4">
            <h2 className="eyebrow">{FOOTER.columns.services}</h2>
            <ul className="mt-6 space-y-3">
              {SERVICES.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="link-draw text-[0.9375rem] text-bone/75 hover:text-bone"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Studio" className="lg:col-span-3 lg:col-start-10">
            <h2 className="eyebrow">{FOOTER.columns.company}</h2>
            <ul className="mt-6 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="link-draw text-[0.9375rem] text-bone/75 hover:text-bone"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="hairline mt-20 flex flex-col gap-4 pt-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1 text-[0.8125rem] text-bone/45">
            {FOOTER.legal.map((line) => (
              <p key={line} className="text-bone/45">
                {line}
              </p>
            ))}
            <p className="max-w-lg pt-2 text-bone/35">{FOOTER.disclaimer}</p>
          </div>
          <p className="shrink-0 text-[0.8125rem] text-bone/45">
            &copy; {year} {SITE.legalName}
          </p>
        </div>
      </div>
    </footer>
  );
}
