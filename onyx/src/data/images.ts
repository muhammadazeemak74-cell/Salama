/**
 * All placeholder photography lives here so it can be swapped for real
 * shoot assets later. Every URL is pinned with `?lock=<n>` so a given
 * card always renders the same image on every load.
 *
 * Source: loremflickr.com (car-only, keyword-matched placeholder photos).
 */

const flickr = (keywords: string, lock: number, w = 900, h = 1200) =>
  `https://loremflickr.com/${w}/${h}/${keywords}?lock=${lock}`;

export const fleetImages = {
  cadillacEscalade: flickr("cadillac,escalade", 1),
  gmcYukonDenali: flickr("gmc,yukon", 2),
  mercedesSClass: flickr("mercedes,s-class", 3),
  mercedesVClass: flickr("mercedes,van", 4),
  bmw7Series: flickr("bmw,7-series", 5),
  rangeRover: flickr("range,rover", 6),
  rollsRoyceGhost: flickr("rolls,royce", 7),
};

export const arrivalImages = {
  hero: flickr("airport,luxury,car", 101, 1920, 1280),
  spotlightWide: flickr("airport,luxury,car", 102, 1920, 1080),
  spotlightDetail: flickr("airport,luxury,car", 103, 1200, 1500),
  howItWorks: flickr("airport,luxury,car", 104, 1200, 1200),
};
