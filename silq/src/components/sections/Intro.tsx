import { INTRO } from "@/content/copy";
import { RevealBlock, RevealText } from "@/components/motion/RevealText";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

/**
 * The positioning statement. Deliberately the widest type on the page after
 * the hero — this is the one idea a visitor should leave with.
 */
export function Intro() {
  return (
    <section id="intro" className="section">
      <div className="shell">
        <RevealBlock>
          <p className="eyebrow">{INTRO.eyebrow}</p>
        </RevealBlock>

        <RevealText
          as="h2"
          lines={INTRO.lines}
          className="t-display opsz-display mt-10 max-w-[18ch]"
          lastLineClassName="text-clay"
          delay={0.05}
        />

        <div className="mt-20 grid gap-12 lg:mt-28 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6 lg:col-start-1">
            <ParallaxImage
              slot="intro-editorial"
              className="aspect-[4/3] w-full"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          {/* Spacing lives on the wrapper: each paragraph is the only child of
              its own reveal block, so a `first:` variant would match them all. */}
          <div className="space-y-6 lg:col-span-5 lg:col-start-8 lg:self-end">
            {INTRO.body.map((paragraph, index) => (
              <RevealBlock key={paragraph} delay={index * 0.1}>
                <p className="t-lead">{paragraph}</p>
              </RevealBlock>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
