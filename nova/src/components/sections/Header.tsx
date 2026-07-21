"use client";

import { useEffect, useState } from "react";
import { nav, site } from "@/data/content";
import { WhatsAppButton } from "../ui/WhatsAppButton";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [logoOk, setLogoOk] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-ink/8 bg-base/80 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        <a href="#top" className="flex items-center gap-2" aria-label={site.name}>
          {/* Real logo dropped at /public/logo.png swaps in; text is fallback. */}
          <img
            src="/logo.png"
            alt={site.name}
            className={`h-8 w-auto ${logoOk ? "block" : "hidden"}`}
            onLoad={() => setLogoOk(true)}
            onError={() => setLogoOk(false)}
          />
          {!logoOk && (
            <span
              className={`font-display text-lg font-semibold tracking-tight transition-colors duration-300 ${
                scrolled ? "text-ink" : "text-white drop-shadow-[0_1px_8px_rgba(20,48,74,0.6)]"
              }`}
            >
              {site.logoLockup.first}{" "}
              <span className="text-orange">{site.logoLockup.second}</span>
            </span>
          )}
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors duration-300 ${
                scrolled
                  ? "text-ink/70 hover:text-ink"
                  : "text-white/85 hover:text-white drop-shadow-[0_1px_8px_rgba(20,48,74,0.6)]"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center">
          <WhatsAppButton label="WhatsApp" className="px-5 py-2.5 text-sm" />
        </div>
      </div>
    </header>
  );
}
