"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";

interface ZoomableImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  /** Classes for the trigger button (framing, background, padding, radius). */
  className?: string;
  /** Classes for the trigger image (rounding, etc.). */
  imgClassName?: string;
  /** Hover hint text, e.g. "Ver folleto completo". */
  hint?: string;
}

/**
 * Displays an image full and uncropped (never object-cover) and opens it
 * full-screen on click — dark backdrop, object-contain, close on tap/Esc.
 * Used for the client's square flyers and the brochure.
 */
export function ZoomableImage({
  src,
  alt,
  width,
  height,
  sizes,
  quality = 90,
  priority,
  className = "",
  imgClassName = "",
  hint,
}: ZoomableImageProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ampliar folleto: ${alt}`}
        className={`group/zoom relative block w-full cursor-zoom-in ${className}`}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          quality={quality}
          priority={priority}
          className={`h-auto w-full ${imgClassName}`}
        />
        {hint && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/80 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur transition-opacity duration-300 group-hover/zoom:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={2} />
            {hint}
          </span>
        )}
      </button>

      {/* Portal to <body> so the fixed overlay escapes any transformed
          (Framer Motion) ancestor and truly covers the viewport. */}
      {open &&
        mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-ink/92 p-4 backdrop-blur-sm sm:p-10"
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              quality={95}
              className="pointer-events-none object-contain"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
