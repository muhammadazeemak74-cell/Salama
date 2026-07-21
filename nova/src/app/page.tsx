import { resolveImages } from "@/lib/unsplash";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Experiences } from "@/components/sections/Experiences";
import { Included } from "@/components/sections/Included";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { Footer } from "@/components/sections/Footer";

export default async function Home() {
  const images = await resolveImages();

  return (
    <>
      <Header />
      <main>
        <Hero image={images.hero} />
        <About
          imagePrimary={images.aboutPrimary}
          imageSecondary={images.aboutSecondary}
        />
        <Experiences images={images} />
        <Included />
        <HowItWorks />
        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
