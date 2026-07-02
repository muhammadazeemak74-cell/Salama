import Image from "next/image";
import { site } from "@/data/site";
import { fleetImages, arrivalImages } from "@/data/images";
import { Button } from "../ui/Button";

const instagramStrip = [
  fleetImages.rollsRoyceGhost,
  fleetImages.mercedesSClass,
  arrivalImages.spotlightWide,
  fleetImages.rangeRover,
  fleetImages.cadillacEscalade,
  arrivalImages.howItWorks,
];

const stats = [
  { label: "Rating", value: `${site.rating} / 5` },
  { label: "Fleet", value: site.fleetSize },
  { label: "Chauffeurs", value: site.languages },
];

export function ProofFooter() {
  return (
    <footer className="relative w-full border-t border-gold/10 pt-20">
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
        <div className="grid grid-cols-1 gap-6 border-b border-gold/10 pb-16 lg:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center lg:text-left">
              <p className="text-xs uppercase tracking-[0.25em] text-gold">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-2xl text-off-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 py-16 sm:grid-cols-3 lg:grid-cols-6">
          {instagramStrip.map((src, i) => (
            <div
              key={src + i}
              className="relative aspect-square overflow-hidden rounded-lg"
            >
              <Image
                src={src}
                alt="ONYX chauffeur fleet"
                fill
                sizes="(min-width: 1024px) 16vw, 33vw"
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-6 border-t border-gold/10 py-16 text-center">
          <p className="font-display text-3xl text-off-white sm:text-4xl">
            {site.hours} · {site.instagramHandle}
          </p>
          <p className="max-w-md text-sm text-off-white/60">
            {site.name} is a private chauffeur and rental service. Not a taxi
            or ride-hailing platform.
          </p>
          <Button href={site.whatsappLink} external>
            Reserve on WhatsApp
          </Button>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-gold/10 py-8 text-xs text-off-white/40 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {site.name} Dubai. All rights reserved.</p>
          <p>{site.phoneDisplay}</p>
        </div>
      </div>
    </footer>
  );
}
