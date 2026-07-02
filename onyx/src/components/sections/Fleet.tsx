import { fleet } from "@/data/fleet";
import { site } from "@/data/site";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";
import { FleetCard } from "./FleetCard";

export function Fleet() {
  return (
    <Section id="fleet">
      <div className="mb-14 max-w-2xl">
        <Eyebrow>The Fleet</Eyebrow>
        <h2 className="font-display text-4xl text-off-white sm:text-5xl">
          Seven cars. One standard.
        </h2>
        <p className="mt-4 text-off-white/60">
          Every vehicle detailed, inspected and fuelled before you land.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {fleet.map((car) => (
          <FleetCard key={car.slug} car={car} />
        ))}

        <div className="panel flex flex-col justify-between gap-6 rounded-2xl p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold">
              Something else?
            </p>
            <h3 className="mt-3 font-display text-2xl text-off-white">
              Ask the concierge
            </h3>
            <p className="mt-3 text-sm text-off-white/60">
              Sprinter vans, exotic weekend cars, or a specific request —
              message us directly and we&apos;ll source it.
            </p>
          </div>
          <Button href={site.whatsappLink} external variant="secondary">
            Message on WhatsApp
          </Button>
        </div>
      </div>

      <div className="mt-14 flex justify-center">
        <Button href={site.whatsappLink} external>
          Reserve on WhatsApp
        </Button>
      </div>
    </Section>
  );
}
