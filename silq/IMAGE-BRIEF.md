# SILQ — image pipeline

The site has 22 image slots. All of them are fetched, graded and written by one
command.

## Where the images come from

Photography is assembled **during the build**, not committed. `npm run build`
runs `scripts/prepare-images.mjs` first, which, in order:

1. uses any of your own photographs from `photos/` — these always win;
2. fetches the rest from Pexels if `PEXELS_API_KEY` is set;
3. fills anything still missing with a gradient placeholder.

So the site always builds, with or without a key, online or offline.
`public/images/` is gitignored — it is build output.

### On Vercel

Add `PEXELS_API_KEY` under **Settings → Environment Variables** (Production and
Preview). It is only read during the build; it is not `NEXT_PUBLIC_`, so it
never reaches the browser. The next deploy ships photography.

### Locally

```bash
# Get a free key (instant, no card) at https://www.pexels.com/api/
cp .env.local.example .env.local     # then paste the key in
npm run images                        # fills every empty slot
```

Without a key, `npm run dev` and `npm run build` both still work — you just get
gradients.

### Pin your picks (recommended after the first successful build)

Every build re-searches Pexels, and Pexels results drift over time, so **the
hero can silently change between deploys.** To stop that:

```bash
npm run images        # locally, with a key
git add image-candidates.json && git commit -m "Pin photography picks"
```

With that file committed, the fetch reuses the cached candidate list instead of
searching. Picks become deterministic, and every deploy makes 21 downloads
instead of 21 searches plus 21 downloads.

`PEXELS_API_KEY` is **build-time only**. It is never prefixed `NEXT_PUBLIC_`,
never imported by anything under `src/`, and never reaches the browser.
`.env.local` is gitignored.

| Command | What it does |
| --- | --- |
| `npm run build` | Prepares images (fetch if keyed, else placeholders), then builds. |
| `npm run images` | Fetches any slot that has no file yet. Safe to re-run. |
| `npm run images -- --force` | Re-fetches and overwrites everything. |
| `npm run images:blur` | No network. Refreshes blur previews from whatever is on disk. |
| `npm run images:placeholders` | Writes a plain warm gradient into any still-empty slot so the site always builds. |

## What the fetch does

1. **Searches** Pexels per slot with the tuned query and orientation below,
   `size=large`, `per_page=15`, 250ms between requests.
2. **Scores** all 15 candidates and rejects any whose dominant colour will fight
   the bone/clay palette — saturated green, cyan, blue and violet are thrown
   out, as are frames that are too dark or blown out. Near-neutral images pass
   whatever their hue, because a grey-beige interior reads as warm once graded.
   Remaining candidates are ranked by warmth, then by resolution.
3. **Writes all 15** to `image-candidates.json`, best first, with the rejected
   ones last and the reason recorded.
4. **Crops** the winner to the slot's exact dimensions with `fit: cover` and
   sharp's `attention` strategy, so the crop lands on the subject.
5. **Grades** every image identically — saturation 0.82, brightness 1.02, and a
   6% bone wash composited over the top. This is what stops 21 unrelated stock
   photographs from looking like 21 unrelated stock photographs.
6. **Encodes** WebP at quality 82 plus a JPEG of the same processed pixels.
7. **Generates** `src/content/blur-data.ts` (blur-up previews) and
   `src/content/credits.ts` (attribution, which powers `/credits`).

## Changing a pick you do not like

Every candidate is already in `image-candidates.json`. No need to re-search:

```jsonc
"svc-keratin": {
  "selectedIndex": 0,        // ← change to 3, save
  "candidates": [ /* 15 of them, with avgColor, score, photographer */ ]
}
```

```bash
npm run images -- --force
```

The cached candidate list is reused, so the choice is reproducible and costs no
API quota. `selectedIndex` persists.

## The treatment rule

**Any image that still looks like a bright commercial stock photo is a
rejection.** Open it, and if it does, bump `selectedIndex` and re-run. The grade
does a lot but it cannot save a photo that was lit like an advert.

**Never show a face at a size where it reads as "this is our stylist."** Prefer
back-of-head, hands, hair detail and cropped compositions. This site sells
craft, not personalities — and it avoids implying that stock models are real
clients. The queries below are chosen with that in mind; check the result.

On top of the baked grade, the gallery and service images also carry a runtime
`--champagne` overlay at 8% `mix-blend-multiply`, so the palette wins over the
photography even if someone drops in an ungraded file.

## Slots

### Feature

| Slot | Dimensions | Orientation | Query |
| --- | --- | --- | --- |
| `hero` | 2400 × 1600 | landscape | woman long glossy brown hair back view |
| `intro-editorial` | 1600 × 1200 | landscape | hairdresser hands sectioning hair |
| `booking-block` | 1800 × 1200 | landscape | beige minimal interior soft daylight |
| `og-image` | 1200 × 630 | landscape | *(no search — cropped from `hero`)* |

### Services — all 1400 × 1750, portrait

| Slot | Service | Query |
| --- | --- | --- |
| `svc-cutting` | Hair Cutting | hairdresser cutting long hair scissors |
| `svc-colouring` | Hair Colouring | hair colour application brush bowl salon |
| `svc-highlights` | Highlights, Balayage, Babylights & Ombré | balayage blonde hair back view |
| `svc-treatment` | Hair Treatments | hair mask treatment application salon |
| `svc-keratin` | Keratin & Protein | straight glossy smooth brown hair |
| `svc-botox-spa` | Hair Botox & Hair Spa | hair wash basin scalp massage salon |
| `svc-styling` | Styling, Updos & Retro Waves | elegant hair updo bridal styling |
| `svc-threading` | Brow & Face Threading | eyebrow shaping close up beauty |

### Gallery

> **These ten are temporary.** See the warning below.

| Slot | Dimensions | Orientation | Query |
| --- | --- | --- | --- |
| `gal-01` | 1000 × 1400 | portrait | brunette balayage hair salon |
| `gal-02` | 1400 × 1000 | landscape | blowout wavy hair styling |
| `gal-03` | 1000 × 1400 | portrait | caramel highlights long hair |
| `gal-04` | 1000 × 1400 | portrait | sleek straight dark hair portrait |
| `gal-05` | 1400 × 1000 | landscape | hair curling iron waves |
| `gal-06` | 1000 × 1400 | portrait | ombre hair colour long |
| `gal-07` | 1000 × 1400 | portrait | bridal hair pinned updo detail |
| `gal-08` | 1400 × 1000 | landscape | glossy healthy hair shine close up |
| `gal-09` | 1000 × 1400 | portrait | short bob haircut styling |
| `gal-10` | 1400 × 1000 | landscape | hair foils highlights process |

## The gallery is placeholder work

The ten gallery slots are stock. They **must** be replaced with real
before/after client work before any paid traffic is sent to this site. Stock
transformation photos on a service business are the fastest way to lose trust in
this market — the people booking at-home colour in Dubai have seen the same
Pexels images on six competitor sites.

To replace: drop your own files into the committed **`photos/`** directory,
named after the slot — `photos/gal-01.jpg` … `photos/gal-10.jpg`. Any format,
any size; the build crops each to the slot's dimensions and it takes precedence
over anything fetched. No code change. See `photos/README.md`.

(`public/images/` is build output and gitignored, so it is not somewhere a real
photograph can live — that is what `photos/` is for.)

Shooting notes for real client work:

- Daylight wherever possible. Warm indoor bulbs pull colour work orange and
  misrepresent the result.
- Back-of-head shots sell colour better than faces, and sidestep the consent
  problem almost entirely.
- Before/after pairs need the same spot, light and distance. A pair shot in
  different conditions reads as dishonest even when it is not.
- Get written permission from any client whose hair appears on the site.

## Icons

`src/app/icon.png` (512²) and `src/app/apple-icon.png` (180²) are generated by
`npm run images:placeholders` from the wordmark, not from photography. Replace
with real brand marks when they exist; keep the filenames.
