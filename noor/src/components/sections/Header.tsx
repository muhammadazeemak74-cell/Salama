"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { site } from "@/data/site";
import { Button } from "../ui/Button";

export function Header() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 400], [0, 1]);
  const y = useTransform(scrollY, [0, 400], [-12, 0]);

  return (
    <motion.header
      style={{ opacity, y }}
      className="panel fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 sm:px-10"
    >
      <Link
        href="#"
        className="font-display text-lg tracking-[0.2em] text-bone"
      >
        NOOR
      </Link>
      <Button href={site.whatsappLink} external className="px-5 py-2.5 text-xs">
        Reserve on WhatsApp
      </Button>
    </motion.header>
  );
}
