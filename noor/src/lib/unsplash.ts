const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";

export interface UnsplashImage {
  url: string;
  alt: string;
}

/**
 * Server-only: fetches the first landscape result for a query from Unsplash,
 * cached for a day. Returns null (never throws) if UNSPLASH_ACCESS_KEY is
 * unset or the request fails, so callers can fall back to a placeholder
 * instead of a broken image.
 *
 * TODO: replace with the client's own fleet/location photography before launch.
 */
export async function fetchUnsplashImage(
  query: string
): Promise<UnsplashImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const params = new URLSearchParams({
      query,
      orientation: "landscape",
      per_page: "1",
    });

    const res = await fetch(`${UNSPLASH_SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.results?.[0];
    if (!result?.urls?.regular) return null;

    return {
      url: result.urls.regular as string,
      alt: (result.alt_description as string | null) ?? query,
    };
  } catch {
    return null;
  }
}
