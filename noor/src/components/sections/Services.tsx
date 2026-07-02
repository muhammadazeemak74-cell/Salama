import { services } from "@/data/services";
import { site } from "@/data/site";
import { Section } from "../ui/Section";
import { Eyebrow } from "../ui/Eyebrow";
import { Button } from "../ui/Button";

export function Services() {
  return (
    <Section id="services">
      <div className="mb-14 max-w-2xl">
        <Eyebrow>Services</Eyebrow>
        <h2 className="font-display text-4xl text-bone sm:text-5xl">
          Wherever the trip takes you.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.index}
            className="panel flex flex-col gap-4 rounded-2xl p-7"
          >
            <span className="font-display text-3xl text-silver/40">
              {service.index}
            </span>
            <h3 className="font-display text-xl text-bone">
              {service.title}
            </h3>
            <p className="text-sm leading-relaxed text-bone/60">
              {service.description}
            </p>
          </div>
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
