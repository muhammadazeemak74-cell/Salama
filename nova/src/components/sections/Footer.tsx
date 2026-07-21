import { Mail } from "lucide-react";
import { contact, site } from "@/data/content";
import { Eyebrow } from "../ui/Eyebrow";
import { Reveal } from "../ui/Reveal";
import { WhatsAppButton } from "../ui/WhatsAppButton";
import { DottedRule } from "../ui/DottedRule";
import { WhatsAppIcon, InstagramIcon } from "../ui/BrandIcons";

export function Footer() {
  return (
    <footer id="contacto" className="relative mt-8">
      <div className="mx-auto w-full max-w-6xl px-6 pb-14 pt-24 sm:px-8">
        <Reveal>
          <div className="grain relative overflow-hidden rounded-[2.25rem] border border-white/60 bg-base/80 p-9 backdrop-blur-md shadow-[0_50px_100px_-50px_rgba(20,48,74,0.55)] sm:p-14">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Eyebrow>{contact.eyebrow}</Eyebrow>
                <h2 className="max-w-xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                  {contact.title}
                </h2>
                <p className="mt-5 max-w-lg text-base leading-relaxed text-ink/70">
                  {contact.body}
                </p>
                <div className="mt-8">
                  <WhatsAppButton label={contact.cta} />
                </div>
              </div>

              <div className="lg:col-span-5 lg:pl-8">
                <div className="space-y-3 text-sm">
                  <a
                    href={site.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-ink/75 transition-colors hover:text-ink"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/10 text-teal-deep">
                      <WhatsAppIcon className="h-4 w-4" />
                    </span>
                    +971 58 305 9479
                  </a>
                  <a
                    href={site.instagram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-ink/75 transition-colors hover:text-ink"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/10 text-teal-deep">
                      <InstagramIcon className="h-4 w-4" />
                    </span>
                    {site.instagram.handle}
                  </a>
                  <a
                    href={`mailto:${site.email}`}
                    className="flex items-center gap-3 text-ink/75 transition-colors hover:text-ink"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/10 text-teal-deep">
                      <Mail className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    {site.email}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <DottedRule className="mt-14" />

        <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt={site.name}
              className="h-16 w-auto mix-blend-multiply"
            />
            <p className="mt-2 text-sm italic text-ink/55">{site.tagline}</p>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
            {site.location}
          </p>
        </div>
      </div>
    </footer>
  );
}
