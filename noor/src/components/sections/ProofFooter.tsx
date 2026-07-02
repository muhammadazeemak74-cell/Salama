import Image from "next/image";
import { site } from "@/data/site";
import { fetchUnsplashImage } from "@/lib/unsplash";
import { Button } from "../ui/Button";
import { GradientFallback } from "../ui/GradientFallback";

const INSTAGRAM_QUERIES = [
  "Dubai skyline night",
  "luxury car Dubai",
  "chauffeur",
  "Dubai marina night",
  "Rolls Royce Dubai",
  "Dubai downtown night",
];

const stats = [
  { label: "Rating", value: `${site.rating} / 5` },
  { label: "Fleet", value: site.fleetSize },
  { label: "Track Record", value: site.arrivalsHandled },
  { label: "Hours", value: site.hours },
];

export async function ProofFooter() {
  const instagramImages = await Promise.all(
    INSTAGRAM_QUERIES.map((query) => fetchUnsplashImage(query))
  );

  return (
    <footer className="relative w-full border-t border-cyan-light/10 pt-20">
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
        <div className="grid grid-cols-1 gap-6 border-b border-cyan-light/10 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center lg:text-left">
              <p className="text-gradient text-xs uppercase tracking-[0.25em]">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-2xl text-pearl">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 py-16 sm:grid-cols-3 lg:grid-cols-6">
          {INSTAGRAM_QUERIES.map((query, i) => {
            const image = instagramImages[i];
            return (
              <div
                key={query}
                className="relative aspect-square overflow-hidden rounded-lg"
              >
                {image ? (
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 1024px) 16vw, 33vw"
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                ) : (
                  <GradientFallback index={i} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-6 border-t border-cyan-light/10 py-16 text-center">
          <p className="font-display text-3xl text-pearl sm:text-4xl">
            {site.hours} &middot; {site.instagramHandle}
          </p>
          <p className="max-w-md text-sm text-pearl/60">
            {site.name} is a private chauffeur and rental service. Not a taxi
            or ride-hailing platform.
          </p>
          <Button href={site.whatsappLink} external>
            Reserve on WhatsApp
          </Button>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-cyan-light/10 py-8 text-xs text-pearl/40 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {site.name} Dubai. All rights
            reserved.
          </p>
          <p>{site.phoneDisplay}</p>
        </div>
      </div>
    </footer>
  );
}
