import "server-only";
import type { ImageSlot } from "@/data/content";
import { imageQueries } from "@/data/images";

export interface ResolvedImage {
  url: string;
  alt: string;
  credit: { name: string; link: string } | null;
}

export type ResolvedImages = Record<ImageSlot, ResolvedImage | null>;

interface UnsplashPhoto {
  urls?: { regular?: string; full?: string };
  alt_description?: string | null;
  description?: string | null;
  user?: { name?: string; links?: { html?: string } };
}

const API = "https://api.unsplash.com/search/photos";

/**
 * Fetch the first landscape Unsplash result for a query. Server-side only.
 * Results are cached for a day via Next's fetch cache. Returns null on any
 * failure (missing key, network, rate-limit) so callers fall back to a
 * brand-gradient card rather than a broken image.
 */
async function fetchOne(
  query: string,
  accessKey: string
): Promise<ResolvedImage | null> {
  try {
    const url = `${API}?query=${encodeURIComponent(
      query
    )}&orientation=landscape&per_page=1&content_filter=high`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { results?: UnsplashPhoto[] };
    const photo = data.results?.[0];
    const src = photo?.urls?.regular;
    if (!photo || !src) return null;

    return {
      url: src,
      alt: photo.alt_description || photo.description || query,
      credit: photo.user?.name
        ? {
            name: photo.user.name,
            link: photo.user.links?.html || "https://unsplash.com",
          }
        : null,
    };
  } catch {
    return null;
  }
}

const EMPTY: ResolvedImages = Object.fromEntries(
  (Object.keys(imageQueries) as ImageSlot[]).map((slot) => [slot, null])
) as ResolvedImages;

/**
 * Resolve every image slot in one pass. If UNSPLASH_ACCESS_KEY is unset, every
 * slot resolves to null (graceful brand-gradient fallback) — the site still
 * builds and renders cleanly with no external image dependency.
 */
export async function resolveImages(): Promise<ResolvedImages> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn(
      "[nova] UNSPLASH_ACCESS_KEY is not set — section photos will fall back " +
        "to brand-gradient placeholders. Set it in .env.local (see .env.example) " +
        "to load real Dubai photography."
    );
    return EMPTY;
  }

  const slots = Object.keys(imageQueries) as ImageSlot[];
  const results = await Promise.all(
    slots.map((slot) => fetchOne(imageQueries[slot], accessKey))
  );

  return Object.fromEntries(
    slots.map((slot, i) => [slot, results[i]])
  ) as ResolvedImages;
}
