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
    title: "Your chauffeur greets you",
    description: "Waiting at the gate before passport control, name in hand.",
  },
  {
    step: "03",
    title: "Luggage handled",
    description: "Belt to boot, cabin ready, route already planned.",
  },
  {
    step: "04",
    title: "Glide to your hotel",
    description: "Direct, unhurried, exactly where you need to be.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <div className="mb-14 max-w-2xl">
        <Eyebrow>How It Works</Eyebrow>
        <h2 className="font-display text-4xl text-bone sm:text-5xl">
          From runway to arrival, in four steps.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.step} className="flex flex-col gap-3 rounded-2xl p-2">
            <span className="font-display text-3xl text-silver/40">
              {s.step}
            </span>
            <h3 className="font-display text-xl text-bone">{s.title}</h3>
            <p className="text-sm leading-relaxed text-bone/60">
              {s.description}
            </p>
          </div>
        ))}
      </div>

      <div className="panel mt-14 flex flex-col gap-6 rounded-2xl p-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-grey">
              Coverage
            </p>
            <p className="mt-2 max-w-lg text-bone/70">
              {site.coverage.join(" · ")}
            </p>
          </div>
          <Button href={site.whatsappLink} external>
            Reserve on WhatsApp
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs uppercase tracking-[0.2em] text-bone/50">
          {site.promises.map((promise) => (
            <span key={promise}>{promise}</span>
          ))}
        </div>
      </div>
    </Section>
  );
}
