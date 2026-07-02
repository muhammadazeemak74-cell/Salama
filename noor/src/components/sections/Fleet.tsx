import { fleet } from "@/data/fleet";
import { site } from "@/data/site";
import { fetchUnsplashImage } from "@/lib/unsplash";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import { FleetCard } from "./FleetCard";

export async function Fleet() {
  const images = await Promise.all(
    fleet.map((car) => fetchUnsplashImage(car.imageQuery))
  );

  return (
    <Section id="fleet">
      <div className="mb-14 max-w-2xl">
        <Eyebrow>The Fleet</Eyebrow>
        <h2 className="font-display text-4xl text-pearl sm:text-5xl">
          Eight cars. One standard.
        </h2>
        <p className="mt-4 text-pearl/60">
          Every vehicle detailed, inspected and fuelled before you land.
          Pricing shown is a placeholder — final rates confirmed on booking.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {fleet.map((car, i) => (
          <FleetCard key={car.slug} car={car} image={images[i]} fallbackIndex={i} />
        ))}
      </div>

      <div className="mt-14 flex justify-center">
        <Button href={site.whatsappLink} external>
          Reserve on WhatsApp
        </Button>
      </div>
    </Section>
  );
}
