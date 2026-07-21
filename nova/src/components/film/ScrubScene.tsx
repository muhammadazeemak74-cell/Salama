"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { ImageSlot } from "@/data/content";
import type { ResolvedImage } from "@/lib/unsplash";
import { SmartImage } from "@/components/ui/SmartImage";

interface ScrubSceneProps {
  /** Matches the footage/frames folder, e.g. "scene-1". */
  scene: string;
  /** Frame count from the server-read manifest. 0 → static Unsplash fallback. */
  frameCount: number;
  fallback: ResolvedImage | null;
  fallbackSlot: ImageSlot;
  fallbackAlt: string;
  /** Hero preloads eagerly; others lazy-load within ~1.5 viewports. */
  priority?: boolean;
  /** Height of the tall scrub wrapper in vh (drives how long it pins). */
  heightVh?: number;
  align?: "center" | "bottom";
  kicker?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

export function ScrubScene({
  scene,
  frameCount,
  fallback,
  fallbackSlot,
  fallbackAlt,
  priority = false,
  heightVh = 280,
  align = "bottom",
  kicker,
  title,
  subtitle,
  children,
}: ScrubSceneProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const hasFrames = frameCount > 0;
  // Progress the overlay titles fade/translate against (0→1 through the scene).
  const progress = useMotionValue(0);
  // Visible as soon as the scene is on screen (it pins immediately), with a
  // gentle upward parallax drift, fading out only as the scene exits.
  const overlayOpacity = useTransform(progress, [0, 0.8, 0.96], [1, 1, 0]);
  const overlayY = useTransform(progress, [0, 1], [0, -46]);

  useEffect(() => {
    if (!hasFrames) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Pick frame resolution: 720 on small / low-memory devices, else 1440.
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
    const isMobile = window.innerWidth < 768;
    const res = isMobile || lowMem ? 720 : 1920;
    const disposeOffscreen = isMobile;

    const url = (i: number) => `/frames/${scene}/${res}/frame-${pad4(i + 1)}.jpg`;

    const images: (HTMLImageElement | null)[] = new Array(frameCount).fill(null);
    const loaded = new Array<boolean>(frameCount).fill(false);
    let token = 0; // invalidates in-flight loads after disposal

    // --- progressive, concurrency-limited loader ---
    let next = 0;
    let active = 0;
    const MAX_CONCURRENT = 6;
    function pump() {
      const myToken = token;
      while (active < MAX_CONCURRENT && next < frameCount) {
        const i = next++;
        active++;
        const img = new Image();
        img.decoding = "async";
        const done = () => {
          active--;
          if (myToken === token) pump();
        };
        img.onload = () => {
          if (myToken !== token) return;
          images[i] = img;
          loaded[i] = true;
          if (i === 0) drawFrame();
          done();
        };
        img.onerror = done;
        img.src = url(i);
      }
    }
    function startLoading() {
      if (next >= frameCount) return;
      pump();
    }
    function disposeFrames() {
      token++;
      next = 0;
      active = 0;
      for (let i = 1; i < frameCount; i++) {
        images[i] = null;
        loaded[i] = false;
      }
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false }) ?? null;

    function nearestLoaded(idx: number): HTMLImageElement | null {
      if (loaded[idx]) return images[idx];
      for (let d = 1; d < frameCount; d++) {
        if (idx - d >= 0 && loaded[idx - d]) return images[idx - d];
        if (idx + d < frameCount && loaded[idx + d]) return images[idx + d];
      }
      return null;
    }

    function drawFrame() {
      if (!canvas || !ctx) return;
      const img = nearestLoaded(Math.round(displayed));
      if (!img) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      drawFrame();
    }

    function progressFromRect(): number {
      const el = wrapperRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      if (range <= 0) return 0;
      return Math.min(1, Math.max(0, -rect.top / range));
    }

    let displayed = 0;
    let visible = true;

    // Reduced motion: collapse the pin, show the first frame only, no scrub.
    if (reduced) {
      setCollapsed(true);
      // Load only the poster frame.
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        images[0] = img;
        loaded[0] = true;
        resize();
      };
      img.src = url(0);
      window.addEventListener("resize", resize);
      resize();
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    function tick() {
      if (visible) {
        const p = progressFromRect();
        progress.set(p);
        const target = p * (frameCount - 1);
        displayed += (target - displayed) * 0.2;
        if (Math.abs(target - displayed) < 0.01) displayed = target;
        drawFrame();
      }
      raf = requestAnimationFrame(tick);
    }

    // Lazy start: hero loads now; others wait until within ~1.5 viewports.
    let started = priority;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (e.isIntersecting && !started) {
            started = true;
            startLoading();
          }
          if (!e.isIntersecting && disposeOffscreen && started) {
            started = false;
            disposeFrames();
          }
        }
      },
      { rootMargin: "150% 0px 150% 0px" }
    );
    if (wrapperRef.current) io.observe(wrapperRef.current);

    const ro = new ResizeObserver(resize);
    if (canvas) ro.observe(canvas);
    window.addEventListener("resize", resize);

    resize();
    if (priority) startLoading();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", resize);
      token++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, frameCount, hasFrames, priority]);

  const overlay = (
    <>
      {/* Bottom scrim + subtle top scrim for header/text contrast. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-ink/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent" />
      <motion.div
        style={{ opacity: overlayOpacity, y: overlayY }}
        className={`absolute inset-0 z-10 mx-auto flex w-full max-w-6xl flex-col px-6 sm:px-8 ${
          align === "center"
            ? "items-start justify-center"
            : "items-start justify-end pb-16 sm:pb-20"
        }`}
      >
        {title ? (
          <>
            {kicker && (
              <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-orange">
                <span className="inline-block h-px w-8 bg-orange" />
                {kicker}
              </p>
            )}
            <h2 className="max-w-3xl text-balance-pretty font-display text-4xl font-semibold leading-[1.02] tracking-tight text-white drop-shadow-[0_2px_18px_rgba(20,48,74,0.6)] sm:text-6xl">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 drop-shadow-[0_1px_10px_rgba(20,48,74,0.7)] sm:text-lg">
                {subtitle}
              </p>
            )}
            {children && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">{children}</div>
            )}
          </>
        ) : (
          children
        )}
      </motion.div>
    </>
  );

  // --- Fallback: no footage → static full-bleed Unsplash still. ---
  if (!hasFrames) {
    return (
      <section className="relative flex min-h-dvh w-full items-stretch overflow-hidden bg-ink">
        <div className="absolute inset-0">
          <SmartImage
            image={fallback}
            slot={fallbackSlot}
            alt={fallbackAlt}
            sizes="100vw"
            priority={priority}
          />
        </div>
        {overlay}
      </section>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      style={{ height: collapsed ? "100dvh" : `${heightVh}vh` }}
    >
      <div className="sticky top-0 h-dvh w-full overflow-hidden bg-ink">
        {/* Poster (first frame) — instant paint, no blank flash. */}
        <img
          src={`/frames/${scene}/1920/frame-0001.jpg`}
          alt={fallbackAlt}
          aria-hidden="true"
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!collapsed && (
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        )}
        {overlay}
      </div>
    </div>
  );
}
