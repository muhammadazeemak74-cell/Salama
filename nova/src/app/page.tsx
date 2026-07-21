import { resolveImages } from "@/lib/unsplash";
import { getFrameCounts } from "@/lib/frames";
import { hero, filmChapters } from "@/data/content";
import { Header } from "@/components/sections/Header";
import { About } from "@/components/sections/About";
import { Experiences } from "@/components/sections/Experiences";
import { Included } from "@/components/sections/Included";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { Footer } from "@/components/sections/Footer";
import { ScrubScene } from "@/components/film/ScrubScene";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export default async function Home() {
  const images = await resolveImages();
  const frames = getFrameCounts();
  const count = (scene: string) => frames[scene] ?? 0;

  return (
    <>
      <Header />
      <main>
        {/* Chapter 1 — hero: Dubai aerial */}
        <ScrubScene
          scene={filmChapters.hero.scene}
          frameCount={count(filmChapters.hero.scene)}
          fallback={images[filmChapters.hero.imageSlot]}
          fallbackSlot={filmChapters.hero.imageSlot}
          fallbackAlt={filmChapters.hero.alt}
          priority
          heightVh={300}
          align="center"
        >
          <div id="top" className="max-w-2xl">
            <p className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-orange">
              <span className="inline-block h-px w-10 bg-orange" />
              {hero.eyebrow}
            </p>
            <h1 className="text-balance-pretty font-display text-[2.9rem] font-semibold leading-[0.98] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(20,48,74,0.7)] sm:text-6xl lg:text-7xl">
              Vive Dubái de una forma{" "}
              <span className="italic text-orange">diferente.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 drop-shadow-[0_1px_12px_rgba(20,48,74,0.8)] sm:text-lg">
              {hero.subline}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <WhatsAppButton label={hero.primaryCta} />
              <a
                href="#experiencias"
                className="inline-flex items-center justify-center rounded-full border border-white/60 px-6 py-3 text-sm font-medium tracking-wide text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
              >
                {hero.secondaryCta}
              </a>
            </div>
          </div>
        </ScrubScene>

        {/* Editorial — solid off-white, full readability */}
        <About
          imagePrimary={images.aboutPrimary}
          imageSecondary={images.aboutSecondary}
        />

        {/* Chapter 2 — desert */}
        <ScrubScene
          scene={filmChapters.desert.scene}
          frameCount={count(filmChapters.desert.scene)}
          fallback={images[filmChapters.desert.imageSlot]}
          fallbackSlot={filmChapters.desert.imageSlot}
          fallbackAlt={filmChapters.desert.alt}
          kicker={filmChapters.desert.kicker}
          title={filmChapters.desert.title}
          subtitle={filmChapters.desert.subtitle}
        />

        <Experiences images={images} />

        {/* Chapter 3 — marina */}
        <ScrubScene
          scene={filmChapters.marina.scene}
          frameCount={count(filmChapters.marina.scene)}
          fallback={images[filmChapters.marina.imageSlot]}
          fallbackSlot={filmChapters.marina.imageSlot}
          fallbackAlt={filmChapters.marina.alt}
          kicker={filmChapters.marina.kicker}
          title={filmChapters.marina.title}
          subtitle={filmChapters.marina.subtitle}
        />

        <Included />
        <HowItWorks />

        {/* Chapter 4 — arrival / landmark */}
        <ScrubScene
          scene={filmChapters.arrival.scene}
          frameCount={count(filmChapters.arrival.scene)}
          fallback={images[filmChapters.arrival.imageSlot]}
          fallbackSlot={filmChapters.arrival.imageSlot}
          fallbackAlt={filmChapters.arrival.alt}
          kicker={filmChapters.arrival.kicker}
          title={filmChapters.arrival.title}
          subtitle={filmChapters.arrival.subtitle}
        />

        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
