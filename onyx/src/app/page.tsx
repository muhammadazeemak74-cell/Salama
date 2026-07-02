import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { Fleet } from "@/components/sections/Fleet";
import { Services } from "@/components/sections/Services";
import { Rentals } from "@/components/sections/Rentals";
import { Spotlight } from "@/components/sections/Spotlight";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ProofFooter } from "@/components/sections/ProofFooter";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Fleet />
        <Services />
        <Rentals />
        <Spotlight />
        <HowItWorks />
      </main>
      <ProofFooter />
    </>
  );
}
