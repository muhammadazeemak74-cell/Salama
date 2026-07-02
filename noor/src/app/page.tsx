import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { Arrival } from "@/components/sections/Arrival";
import { Fleet } from "@/components/sections/Fleet";
import { Services } from "@/components/sections/Services";
import { Rentals } from "@/components/sections/Rentals";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ProofFooter } from "@/components/sections/ProofFooter";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Arrival />
        <Fleet />
        <Services />
        <Rentals />
        <HowItWorks />
      </main>
      <ProofFooter />
    </>
  );
}
