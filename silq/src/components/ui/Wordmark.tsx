import Link from "next/link";
import { SITE } from "@/content/site";

/**
 * The wordmark is typographic rather than a logo file, so it stays crisp at any
 * size and inherits the surrounding colour.
 */
export function Wordmark({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const mark = (
    <span
      className={`font-display text-[1.05rem] font-light uppercase leading-none tracking-[0.42em] ${className ?? ""}`}
    >
      {SITE.name}
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} aria-label={`${SITE.name} — home`} className="inline-block">
      {mark}
    </Link>
  );
}
