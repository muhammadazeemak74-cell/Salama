import { SERVICES } from "@/content/services";
import { SERVICES_SECTION } from "@/content/copy";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StickyServiceShowcase } from "@/components/motion/StickyServiceShowcase";

export function Services() {
  return (
    <section id="services" className="section">
      <div className="shell">
        <SectionHeading
          eyebrow={SERVICES_SECTION.eyebrow}
          heading={SERVICES_SECTION.heading}
          intro={SERVICES_SECTION.intro}
        />

        <div className="mt-20 lg:mt-32">
          <StickyServiceShowcase services={SERVICES} />
        </div>
      </div>
    </section>
  );
}
