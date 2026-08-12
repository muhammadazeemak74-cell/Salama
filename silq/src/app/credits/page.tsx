import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_CREDITS } from "@/content/credits";
import { IMAGE_MANIFEST, type ImageSlot } from "@/content/images";
import { RevealBlock, RevealText } from "@/components/motion/RevealText";

export const metadata: Metadata = {
  title: "Photography credits",
  description:
    "Photographers whose work appears on this site, with links to the original photographs on Pexels.",
  alternates: { canonical: "/credits" },
  // A credits page has no business competing for search traffic.
  robots: { index: false, follow: true },
};

/**
 * Attribution page. Pexels does not require credit but asks for it, so every
 * photograph still in use is listed here with a link to the original.
 *
 * Generated entirely from src/content/credits.ts, which the fetch script
 * writes — never hand-written, so it cannot fall out of step with the images
 * actually on disk.
 */
export default function CreditsPage() {
  const entries = Object.entries(PHOTO_CREDITS) as [
    ImageSlot,
    (typeof PHOTO_CREDITS)[ImageSlot],
  ][];

  // One row per photographer rather than per slot — the same photograph can
  // fill more than one slot, and repeating a name reads as padding.
  const byPhotographer = new Map<
    string,
    { photographer: string; photographerUrl: string; photos: Set<string>; slots: ImageSlot[] }
  >();

  for (const [slot, credit] of entries) {
    if (!credit) continue;
    const existing = byPhotographer.get(credit.photographer);
    if (existing) {
      existing.photos.add(credit.photoUrl);
      existing.slots.push(slot);
    } else {
      byPhotographer.set(credit.photographer, {
        photographer: credit.photographer,
        photographerUrl: credit.photographerUrl,
        photos: new Set([credit.photoUrl]),
        slots: [slot],
      });
    }
  }

  const photographers = [...byPhotographer.values()].sort((a, b) =>
    a.photographer.localeCompare(b.photographer),
  );

  return (
    <>
      <header className="shell pb-14 pt-36 lg:pb-20 lg:pt-48">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.24em] text-ash">
            <li>
              <Link href="/" className="link-draw hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>Credits</li>
          </ol>
        </nav>

        <RevealText
          as="h1"
          lines={["Photography credits"]}
          className="t-display opsz-display mt-10 max-w-[14ch]"
        />

        <RevealBlock delay={0.1}>
          <p className="t-lead mt-8 max-w-2xl">
            Photographs on this site are licensed through Pexels. Attribution is not
            required by that licence, but it is asked for, and it costs us nothing to
            give.
          </p>
        </RevealBlock>
      </header>

      <section className="shell pb-28 lg:pb-40">
        {photographers.length === 0 ? (
          <p className="hairline max-w-2xl pt-8">
            No photography is credited yet. Run{" "}
            <code className="font-sans text-ink">npm run images</code> to fetch the
            photographs, and this page fills itself in.
          </p>
        ) : (
          <ul className="hairline pt-2">
            {photographers.map((entry) => (
              <li
                key={entry.photographer}
                className="hairline flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-6 first:border-t-0"
              >
                <a
                  href={entry.photographerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-draw font-display text-[clamp(1.125rem,2vw,1.5rem)] font-light tracking-[-0.025em] text-ink"
                >
                  {entry.photographer}
                </a>

                <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.8125rem] text-ash">
                  {[...entry.photos].map((photoUrl, index) => (
                    <a
                      key={photoUrl}
                      href={photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-draw text-clay-deep"
                    >
                      Photograph {index + 1}
                      <span className="sr-only"> by {entry.photographer} on Pexels</span>
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <RevealBlock delay={0.1}>
          <p className="mt-14 max-w-2xl text-[0.9375rem] text-ash">
            The transformation gallery is stock photography and is placeholder only. It
            will be replaced with real client work.{" "}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noopener noreferrer"
              className="link-draw text-clay-deep"
            >
              Pexels
            </a>
          </p>
        </RevealBlock>

        {/* Slot coverage is useful when swapping images; hidden from readers. */}
        <p className="sr-only">
          {entries.length} of {Object.keys(IMAGE_MANIFEST).length} image slots are
          credited.
        </p>
      </section>
    </>
  );
}
