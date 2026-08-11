import { Hero } from "@/components/sections/Hero";
import { TrustBar } from "@/components/sections/TrustBar";
import { Intro } from "@/components/sections/Intro";
import { Services } from "@/components/sections/Services";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Transformations } from "@/components/sections/Transformations";
import { Coverage } from "@/components/sections/Coverage";
import { Pricing } from "@/components/sections/Pricing";
import { Testimonials } from "@/components/sections/Testimonials";
import { Faq } from "@/components/sections/Faq";
import { Booking } from "@/components/sections/Booking";
import { faqPageSchema, hairSalonSchema, jsonLd } from "@/lib/jsonld";

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(hairSalonSchema())}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqPageSchema())}
      />

      <Hero />
      <TrustBar />
      <Intro />
      <Services />
      <HowItWorks />
      <Transformations />
      <Coverage />
      <Pricing />
      <Testimonials />
      <Faq />
      <Booking />
    </>
  );
}
