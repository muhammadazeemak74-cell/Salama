import { rentalTiers } from "@/data/rentals";
import { site } from "@/data/site";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";

export function Rentals() {
  return (
    <Section id="rentals">
      <div className="mb-14 max-w-2xl">
        <Eyebrow>By the Day, Week, or Month</Eyebrow>
        <h2 className="font-display text-4xl text-bone sm:text-5xl">
          Book for however long the trip runs.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {rentalTiers.map((tier) => (
          <div
            key={tier.period}
            className={`flex flex-col gap-6 rounded-2xl p-8 ${
              tier.featured
                ? "panel ring-1 ring-white/20"
                : "border border-white/10 bg-carbon-2/40"
            }`}
          >
            {tier.featured && (
              <span className="w-fit rounded-full bg-bone px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-carbon">
                Most booked
              </span>
            )}
            <h3 className="font-display text-2xl text-bone">
              {tier.period}
            </h3>
            <p className="font-display text-4xl text-bone">
              AED {tier.fromPriceAed.toLocaleString()}
              <span className="text-base text-bone/50"> {tier.priceSuffix}</span>
            </p>
            <ul className="flex flex-1 flex-col gap-3 text-sm text-bone/70">
              {tier.inclusions.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-silver" />
                  {item}
                </li>
              ))}
            </ul>
            <Button
              href={site.whatsappLink}
              external
              variant={tier.featured ? "primary" : "secondary"}
            >
              Reserve on WhatsApp
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}
