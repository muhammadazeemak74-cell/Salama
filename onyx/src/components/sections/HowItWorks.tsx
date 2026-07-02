import { site } from "@/data/site";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";

const steps = [
  {
    step: "01",
    title: "Land",
    description: "We track your flight from takeoff, delays included.",
  },
  {
    step: "02",
    title: "Meet at the gate",
    description: "Your chauffeur greets you before passport control.",
  },
  {
    step: "03",
    title: "Step into your car",
    description: "Luggage handled, cabin ready, route already planned.",
  },
  {
    step: "04",
    title: "Arrive",
    description: "Direct to your hotel, office, or next stop in the city.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <div className="mb-14 max-w-2xl">
        <Eyebrow>How It Works</Eyebrow>
        <h2 className="font-display text-4xl text-off-white sm:text-5xl">
          From runway to arrival, in four steps.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.step} className="flex flex-col gap-3 rounded-2xl p-2">
            <span className="font-display text-3xl text-gold/70">
              {s.step}
            </span>
            <h3 className="font-display text-xl text-off-white">{s.title}</h3>
            <p className="text-sm leading-relaxed text-off-white/60">
              {s.description}
            </p>
          </div>
        ))}
      </div>

      <div className="panel mt-14 flex flex-col items-start gap-6 rounded-2xl p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold">
            Coverage
          </p>
          <p className="mt-2 max-w-md text-off-white/70">
            {site.coverage.join(" · ")}
          </p>
          <p className="mt-2 text-sm text-off-white/50">
            {site.responseTime}
          </p>
        </div>
        <Button href={site.whatsappLink} external>
          Reserve on WhatsApp
        </Button>
      </div>
    </Section>
  );
}
