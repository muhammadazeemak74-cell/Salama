"use client";

import { motion } from "framer-motion";
import { Button } from "../ui/Button";
import { site } from "@/data/site";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="text-gradient mb-6 text-xs font-medium uppercase tracking-[0.4em]"
      >
        Dubai &middot; Private Chauffeur &amp; Fleet
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.25 }}
        className="font-display text-[3.5rem] leading-[0.95] tracking-tight text-pearl sm:text-8xl md:text-9xl"
      >
        NOOR
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.45 }}
        className="mt-6 font-display text-2xl italic text-cyan-light sm:text-3xl"
      >
        Arrive in light.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.6 }}
        className="text-balance-pretty mt-6 max-w-xl text-base text-pearl/70 sm:text-lg"
      >
        {site.hook}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.75 }}
        className="mt-10 flex flex-col gap-4 sm:flex-row"
      >
        <Button href={site.whatsappLink} external>
          Reserve on WhatsApp
        </Button>
        <Button href={site.phoneLink} variant="secondary">
          Call 24/7
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-pearl/40"
      >
        Scroll
      </motion.div>
    </section>
  );
}
