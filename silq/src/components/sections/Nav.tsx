"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { NAV_LINKS, HERO } from "@/content/copy";
import { GENERAL_ENQUIRY, whatsappLink } from "@/lib/whatsapp";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Wordmark } from "@/components/ui/Wordmark";

/**
 * Transparent over the home page hero, solid bone once the page has scrolled
 * past 80vh — and solid from the top on every other route. On small screens the
 * links move into a full-screen overlay whose items reveal in sequence.
 */
export function Nav() {
  const { scrollY } = useScroll();
  const pathname = usePathname();
  // Only the home page puts a full-bleed dark hero behind the nav. Everywhere
  // else the page starts on bone, so the nav has to be solid from the top or
  // its cream type would sit invisibly on a cream background.
  const overHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reducedMotion = useSafeReducedMotion();
  const solid = !overHero || scrolled;

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > window.innerHeight * 0.8);
  });

  // The overlay owns the viewport while it is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const overlayOpen = open;
  const onLight = solid || overlayOpen;

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        initial={false}
        animate={{
          backgroundColor: solid && !overlayOpen ? "rgba(244,241,236,0.92)" : "rgba(244,241,236,0)",
          borderBottomColor:
            solid && !overlayOpen ? "rgba(216,195,165,0.4)" : "rgba(216,195,165,0)",
        }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{ borderBottomWidth: 1, borderBottomStyle: "solid", backdropFilter: "blur(8px)" }}
      >
        <nav
          aria-label="Primary"
          className="shell flex h-20 items-center justify-between gap-8"
        >
          <Wordmark className={onLight ? "text-ink" : "text-bone"} />

          <ul className="hidden items-center gap-9 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`link-draw text-[0.9375rem] transition-colors duration-300 ${
                    onLight ? "text-ash hover:text-ink" : "text-bone/80 hover:text-bone"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <MagneticButton
              href={whatsappLink(GENERAL_ENQUIRY)}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn hidden py-3 text-[0.875rem] sm:inline-flex ${
                onLight ? "btn-primary" : "bg-bone text-ink hover:bg-champagne"
              }`}
            >
              Book
            </MagneticButton>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className={`relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-[6px] lg:hidden ${
                onLight ? "text-ink" : "text-bone"
              }`}
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <motion.span
                aria-hidden
                className="block h-px w-6 bg-current"
                animate={open ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
              <motion.span
                aria-hidden
                className="block h-px w-6 bg-current"
                animate={open ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 bg-bone lg:hidden"
            initial={reducedMotion ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
            animate={reducedMotion ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
            exit={reducedMotion ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="shell flex h-full flex-col justify-between pb-12 pt-28">
              <ul>
                {NAV_LINKS.map((link, index) => (
                  <li key={link.href} className="overflow-hidden">
                    <motion.div
                      initial={reducedMotion ? { opacity: 0 } : { y: "110%" }}
                      animate={reducedMotion ? { opacity: 1 } : { y: "0%" }}
                      transition={{
                        duration: 0.7,
                        delay: 0.18 + index * 0.06,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block py-2 font-display text-[2.75rem] font-light leading-[1.08] tracking-[-0.04em] text-ink"
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>

              <div className="hairline pt-8">
                <a
                  href={whatsappLink(GENERAL_ENQUIRY)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary w-full"
                  onClick={() => setOpen(false)}
                >
                  {HERO.primaryCta}
                </a>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
