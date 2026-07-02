import Image from "next/image";
import { fetchUnsplashImage } from "@/lib/unsplash";
import { site } from "@/data/site";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import { GradientFallback } from "../ui/GradientFallback";

export async function Arrival() {
  const image = await fetchUnsplashImage("luxury car Dubai night");

  return (
    <section id="arrival" className="relative w-full py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 sm:px-10 lg:grid-cols-2">
        <div>
          <Eyebrow>The Arrival</Eyebrow>
          <h2 className="font-display text-4xl leading-tight text-bone sm:text-5xl">
            Your Dubai begins the moment you land.
          </h2>
          <p className="mt-6 max-w-md text-bone/70">
            Meet & greet at DXB and DWC. Your chauffeur is waiting at the
            gate with your name on a sign, flight already tracked so the car
            is ready the instant you touch down.
          </p>
          <p className="mt-4 max-w-md text-bone/70">
            Luggage handled from belt to boot. From there, it&apos;s a quiet,
            direct line — door to door.
          </p>
          <div className="mt-8">
            <Button href={site.whatsappLink} external>
              Reserve on WhatsApp
            </Button>
          </div>
        </div>

        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <GradientFallback index={0} label="Photography pending" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
}
