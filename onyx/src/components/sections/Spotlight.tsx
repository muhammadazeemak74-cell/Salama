import Image from "next/image";
import { arrivalImages } from "@/data/images";
import { site } from "@/data/site";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";

export function Spotlight() {
  return (
    <section id="the-arrival" className="relative w-full py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 sm:px-10 lg:grid-cols-2">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl">
          <Image
            src={arrivalImages.spotlightDetail}
            alt="Chauffeur greeting a guest planeside in Dubai"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-onyx/70 via-transparent to-transparent" />
        </div>

        <div>
          <Eyebrow>The Signature Moment</Eyebrow>
          <h2 className="font-display text-4xl leading-tight text-off-white sm:text-5xl">
            The Arrival.
          </h2>
          <p className="mt-6 max-w-md text-off-white/70">
            Your chauffeur is waiting at the gate before you clear passport
            control — name card in hand, flight already tracked. Your luggage
            is handled from belt to boot while you step straight into an
            Escalade or S-Class, cabin cooled, water chilled.
          </p>
          <p className="mt-4 max-w-md text-off-white/70">
            Twenty minutes later, you&apos;re at your hotel. No queue, no
            searching for a driver holding a misspelled sign — just a quiet,
            direct line from the runway to the room.
          </p>
          <div className="mt-8">
            <Button href={site.whatsappLink} external>
              Reserve on WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
