"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { HERO } from "@/content/copy";
import { getImage } from "@/content/images";
import { GENERAL_ENQUIRY, whatsappLink } from "@/lib/whatsapp";
import { MagneticButton, MagneticWrap } from "@/components/motion/MagneticButton";

/**
 * Full-viewport opening frame. As the page scrolls the photograph scales up
 * while the frame opens out, so the image appears to expand past its own edges.
 * The headline splits into words that rise in sequence on load.
 *
 * The load-time choreography is CSS, not Framer: these elements are the LCP
 * candidates, and anything held at opacity 0 until hydration drags the largest
 * paint out with it. Framer keeps the scroll-linked work, which by definition
 * cannot happen before the page is interactive anyway.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useSafeReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  const image = getImage("hero");
  const words = HERO.heading.split(" ");

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-sable">
      <motion.div className="absolute inset-0" style={reducedMotion ? undefined : { scale }}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          placeholder="blur"
          blurDataURL={image.blurDataURL}
          className="object-cover"
        />
        {/* Legibility scrim. Weighted to the lower-left where the copy sits. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-tr from-sable/80 via-sable/35 to-sable/10"
        />
      </motion.div>

      {/* The opening frame — four bars retracting. See .hero-curtain. */}
      <div aria-hidden>
        <span className="hero-curtain hero-curtain-t" />
        <span className="hero-curtain hero-curtain-b" />
        <span className="hero-curtain hero-curtain-l" />
        <span className="hero-curtain hero-curtain-r" />
      </div>

      <motion.div
        className="shell relative flex h-full flex-col justify-end pb-16 md:pb-24"
        style={reducedMotion ? undefined : { y: contentY }}
      >
        <p className="eyebrow hero-fade text-champagne" style={{ animationDelay: "150ms" }}>
          {HERO.eyebrow}
        </p>

        <h1 className="t-hero opsz-display mt-6 max-w-[15ch] text-bone">
          {words.map((word, index) => (
            // The space is a sibling text node, not part of the word. Trailing
            // whitespace inside an inline-block is trimmed, which would run the
            // whole headline together.
            <Fragment key={word}>
              <span className="inline-block overflow-hidden pb-[0.06em] align-bottom">
                <span
                  className="hero-rise inline-block"
                  style={{ animationDelay: `${250 + index * 40}ms` }}
                >
                  {word}
                </span>
              </span>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          ))}
        </h1>

        <p
          className="t-lead hero-fade-up mt-8 max-w-xl text-bone/85"
          style={{ animationDelay: "550ms" }}
        >
          {HERO.sub}
        </p>

        <div
          className="hero-fade-up mt-11 flex flex-wrap items-center gap-4"
          style={{ animationDelay: "680ms" }}
        >
          <MagneticButton
            href={whatsappLink(GENERAL_ENQUIRY)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-bone text-ink hover:bg-champagne"
          >
            {HERO.primaryCta}
          </MagneticButton>

          <MagneticWrap>
            <Link
              href="/#services"
              className="btn btn-ghost border-champagne/40 text-bone hover:bg-bone hover:text-ink"
            >
              {HERO.secondaryCta}
            </Link>
          </MagneticWrap>
        </div>
      </motion.div>

      <motion.div
        aria-hidden
        className="absolute bottom-8 right-6 hidden items-center gap-3 md:right-12 md:flex"
        style={reducedMotion ? undefined : { opacity: cueOpacity }}
      >
        <span className="text-[0.6875rem] uppercase tracking-[0.24em] text-bone/70">
          {HERO.scrollCue}
        </span>
        <span className="scroll-cue block h-10 w-px bg-champagne/60" />
      </motion.div>
    </section>
  );
}
