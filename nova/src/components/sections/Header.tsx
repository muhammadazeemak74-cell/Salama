"use client";

import { useEffect, useState } from "react";
import { nav, site } from "@/data/content";
import { WhatsAppButton } from "../ui/WhatsAppButton";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

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
          ? "border-b border-ink/8 bg-base/90 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        <a href="#top" className="flex items-center" aria-label={site.name}>
          {/* Logo has a white background: mix-blend-multiply drops the white on
              our warm off-white header; over the film (not scrolled) a white
              chip gives it a surface so it reads on the video. */}
          <span
            className={`inline-flex items-center rounded-lg transition-all duration-300 ${
              scrolled ? "" : "bg-white/95 p-1.5 shadow-sm"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt={site.name}
              className="h-12 w-auto mix-blend-multiply"
            />
          </span>
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
