"use client";

import Lenis from "lenis";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";

const ScrollContext = createContext<MutableRefObject<number> | null>(null);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const progressRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduced) {
      const onScroll = () => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        progressRef.current = max > 0 ? window.scrollY / max : 0;
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenis.on("scroll", ({ progress }: { progress: number }) => {
      progressRef.current = progress;
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <ScrollContext.Provider value={progressRef}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollProgressRef(): MutableRefObject<number> {
  const ctx = useContext(ScrollContext);
  if (!ctx) {
    throw new Error(
      "useScrollProgressRef must be used within a SmoothScrollProvider"
    );
  }
  return ctx;
}
