import { TRANSFORMATIONS } from "@/content/copy";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HorizontalGallery } from "@/components/motion/HorizontalGallery";

export function Transformations() {
  return (
    <section id="transformations" className="pb-16 pt-24 lg:pb-24 lg:pt-40">
      <div className="shell">
        <SectionHeading
          eyebrow={TRANSFORMATIONS.eyebrow}
          heading={TRANSFORMATIONS.heading}
          intro={TRANSFORMATIONS.intro}
        />
      </div>

      <div className="mt-16 lg:mt-24">
        <HorizontalGallery label={TRANSFORMATIONS.note} />
      </div>
    </section>
  );
}
