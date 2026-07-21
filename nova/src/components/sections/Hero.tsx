"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { hero, site } from "@/data/content";
import type { ResolvedImage } from "@/lib/unsplash";
import { WhatsAppButton } from "../ui/WhatsAppButton";
import { Button } from "../ui/Button";
import { SmartImage } from "../ui/SmartImage";
import { DottedRule } from "../ui/DottedRule";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero({ image }: { image: ResolvedImage | null }) {
  return (
    <section
      id="top"
      className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 pb-20 pt-28 sm:px-8"
    >
      <div className="grid items-center gap-12 lg:grid-cols-12">
        {/* Text — left, deliberately asymmetric. */}
        <div className="lg:col-span-7">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease }}
            className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-teal-deep"
          >
            <span className="inline-block h-px w-10 bg-orange" />
            {hero.eyebrow}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease }}
            className="text-balance-pretty font-display text-[2.9rem] font-semibold leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl"
          >
            Vive Dubái de una forma{" "}
            <span className="italic text-orange">diferente.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.32, ease }}
            className="mt-6 max-w-xl text-base leading-relaxed text-ink/70 sm:text-lg"
          >
            {hero.subline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.45, ease }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <WhatsAppButton label={hero.primaryCta} />
            <Button href="#experiencias" variant="secondary">
              {hero.secondaryCta}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.7 }}
            className="mt-10 max-w-md"
          >
            <DottedRule />
            <p className="mt-4 text-sm text-ink/55">
              Atención en español · Grupos privados · Acompañamiento de principio
              a fin.
            </p>
          </motion.div>
        </div>

        {/* Framed photo — right. */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.35, ease }}
          className="lg:col-span-5"
        >
          <div className="grain relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] border border-white/50 shadow-[0_40px_80px_-40px_rgba(20,48,74,0.5)]">
            <SmartImage
              image={image}
              slot="hero"
              alt="Dubái al atardecer"
              sizes="(min-width: 1024px) 40vw, 90vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-base/85 px-4 py-2 text-xs font-medium text-ink backdrop-blur">
              <MapPin className="h-3.5 w-3.5 text-orange" strokeWidth={2} />
              {site.location}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.35em] text-ink/40"
      >
        Desliza
      </motion.div>
    </section>
  );
}
