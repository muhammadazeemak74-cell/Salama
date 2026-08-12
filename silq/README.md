# SILQ

Marketing site for SILQ — a premium at-home hair studio operating across Dubai.

Positioned as a hair **specialist**, not a general beauty marketplace: colour,
keratin, treatments and styling, plus brow threading as the single bolt-on.
Bookings route to WhatsApp, which is how this market actually converts.

**Tagline:** The studio comes to you.

## Stack

- **Next.js 16** (App Router) with TypeScript in strict mode
- **Tailwind CSS v4** — design tokens defined in `src/app/globals.css`
- **Motion** (`motion/react`, the Framer Motion package) for scroll choreography
- **Lenis** for smooth scrolling
- `next/font` for Fraunces (display) and Inter Tight (body)
- No CMS, no database, no backend. Every route is static.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the production build
npm run lint
npm run images  # fetch + grade photography (needs PEXELS_API_KEY)
```

Photography is fetched at build time rather than committed by hand. See
**IMAGE-BRIEF.md** — the short version is: get a free Pexels key, put it in
`.env.local`, run `npm run images`.

## Where to change things

All editable content lives in `src/content/`. Nothing that an owner would want
to change is hardcoded in a component.

### The WhatsApp number

`src/content/site.ts`:

```ts
export const WHATSAPP_NUMBER = "971500000000";  // digits only, no + and no spaces
export const PHONE_DISPLAY   = "+971 50 000 0000";  // how it is printed on the page
```

`WHATSAPP_NUMBER` is the single source of truth. Every CTA, the booking form,
the footer, the "call instead" link and the structured data all derive from it.
Change it in one place.

Also in this file: the live domain (`SITE_URL`), Instagram handle, opening
hours, and the trade licence line in the footer. Each placeholder is marked with
a `TODO(owner)` comment.

### Prices

`src/content/pricing.ts` — the pricing table, grouped into Cutting & styling,
Colour, Treatments and Threading:

```ts
{ name: "Balayage / Ombré", from: 550 }
{ name: "Kids' haircut", from: 150, note: "Under 12" }   // note is optional
```

The "from AED X" shown on each service block is separate — it comes from
`priceFrom` on that service in `src/content/services.ts`. Keep the two in step.

The disclaimer under the table ("final pricing depends on hair length, density
and current colour") is in `src/content/copy.ts` under `PRICING_SECTION`.

### Services

`src/content/services.ts` holds all eight services. Each entry drives the sticky
showcase on the home page **and** its own SEO landing page, from one object:

```ts
{
  slug: "keratin-treatment-at-home-dubai",   // becomes /services/<slug>
  name: "Keratin & Protein",                 // shown in the showcase and nav
  shortName: "a keratin treatment",          // used in the pre-filled WhatsApp message
  promise: "Smoothing that survives a Dubai summer.",
  description: "…",                          // 2–3 sentences for the showcase
  duration: "3 – 5 hrs",
  priceFrom: 750,
  image: "service-keratin",                  // slot key from src/content/images.ts
  page: {
    title, description,                      // <title> and meta description
    h1, lede,
    sections: [{ heading, paragraphs: [] }], // the long-form body
    faqs: [{ question, answer }],            // rendered as an accordion + FAQ schema
  },
}
```

Editing copy anywhere in that object updates the home page, the service page,
the sitemap, the footer links and the JSON-LD together.

### Adding a new service page

1. Append an entry to the `SERVICES` array in `src/content/services.ts`.
2. Add its image slot to `IMAGE_MANIFEST` in `src/content/images.ts` at
   1400 × 1750, then run `npm run placeholders`.
3. That's it. The route, sitemap entry, footer link, showcase block, structured
   data and metadata are all generated from the array.

Write at least 600 words across `page.sections` — these pages exist to be found,
and thin ones do not rank. Slugs are long-form on purpose
(`keratin-treatment-at-home-dubai`, not `keratin`); that is how this service is
searched for in this city.

### Other copy

| File | What's in it |
| --- | --- |
| `src/content/copy.ts` | Nav labels, hero, trust stats, intro statement, how-it-works steps, section headings, booking form labels, footer |
| `src/content/faq.ts` | The eight home-page FAQ entries |
| `src/content/areas.ts` | Dubai neighbourhoods — also feeds `areaServed` in the structured data |
| `src/content/testimonials.ts` | The three pull-quotes |
| `src/content/images.ts` | Image manifest: dimensions, alt text, search terms |

### Images

See **IMAGE-BRIEF.md** for the pipeline, the slot list and the queries.

- `npm run images` fetches, grades and writes all 22 slots from Pexels.
- To swap a pick you dislike, edit `selectedIndex` in `image-candidates.json`
  and re-run with `--force`. No new search, no quota spent.
- To use your own photograph, drop it at `public/images/<slot>.webp` and run
  `npm run images:blur`.

`PEXELS_API_KEY` lives in `.env.local` (gitignored) and is build-time only —
never `NEXT_PUBLIC_`, never imported under `src/`, never sent to the browser.

**The ten gallery slots are stock placeholders** and must be replaced with real
client work before any paid traffic. This is flagged at the top of
`src/content/images.ts` too.

## Placeholders to replace before launch

Search the codebase for `TODO(owner)`. The ones that matter:

- **`WHATSAPP_NUMBER`** — the site does not work without it.
- **`TRUST_STATS`** in `site.ts` — all four are `null`, so the trust bar does
  not render at all. Fill in only figures you could evidence on request: a
  fabricated review score is a legal exposure for a trade-licensed business.
  The bar renders whichever stats have values, so they can go in one at a time.
  "Areas covered" is safe to switch on immediately — it is `AREAS.length`.
- **`TESTIMONIALS`** — all three are placeholders and say so.
- **`SITE.tradeLicence`** and **`SITE_URL`**.
- **Prices** — researched market benchmarks, not confirmed rates.

## How the motion works

Reusable pieces live in `src/components/motion/`:

| Component | What it does |
| --- | --- |
| `SmoothScroll` | Lenis provider. Drives the real window scroll, so `useScroll` and IntersectionObserver keep working |
| `StickyServiceShowcase` | Sticky image column cross-fading between services as the text column scrolls. Degrades to a vertical stack below `lg` |
| `HorizontalGallery` | Pinned section translating a photo row sideways. Height is measured from the track so the row lands exactly as the pin releases |
| `RevealText` / `RevealBlock` | Line-by-line mask reveal, triggered at 70% of the viewport |
| `ParallaxImage` | Editorial images drifting at 0.85× scroll speed |
| `MagneticButton` | CTA leans toward the cursor within 80px. Mouse input only |
| `CountUp` | Trust-bar figures |
| `CustomCursor` | Clay dot that grows to a 48px "VIEW" disc over gallery images |

Two rules worth knowing before editing these:

- **Everything is gated behind `useSafeReducedMotion()`** (`src/lib/`), not
  Framer's `useReducedMotion` directly. The server cannot read a media query, so
  reading the real preference on the first client render breaks hydration. The
  wrapper reports `false` until hydrated. Change animation *values* on reduced
  motion, never the markup.
- **The hero's load animation is CSS, not JS.** The hero copy is the LCP
  element; holding it at `opacity: 0` until React hydrates pushed the largest
  paint out by about 1.8 seconds on a throttled phone. The entrance keyframes
  live in `globals.css` (`.hero-rise`, `.hero-fade-up`, `.hero-curtain`). Keep
  it that way. Scroll-linked motion stays in Framer, since it cannot happen
  before interactivity anyway.

## Design system

Tokens are in `@theme` at the top of `src/app/globals.css` and are available as
Tailwind utilities (`bg-bone`, `text-ash`, `border-champagne`):

| Token | Value | Use |
| --- | --- | --- |
| `--color-bone` | `#F4F1EC` | Page base. Never pure white |
| `--color-ink` | `#14110F` | Text |
| `--color-clay` | `#9A7B62` | Primary accent — large type and non-text UI only |
| `--color-clay-deep` | `#806046` | The same accent for small text (`--clay` is 3.5:1 on bone, short of the 4.5:1 small-text minimum) |
| `--color-champagne` | `#D8C3A5` | Secondary accent, hairlines, accents on dark |
| `--color-ash` | `#6E6862` | Body text |
| `--color-sable` | `#221D1A` | Dark sections |

Conventions: no drop shadows — depth comes from image scale and colour blocks.
Square corners everywhere except buttons (`999px`). Hairlines are 1px champagne
at 40%. Section padding is 6rem mobile / 12rem desktop. Add `.on-dark` to a
section and hairlines, buttons, headings and body text all invert together.

Type: Fraunces for display (weight 300, tracking -0.04em, `opsz` axis via
`.opsz-display`), Inter Tight for body at 17px/1.65. Only the `opsz` axis is
requested from Fraunces — adding `SOFT` and `WONK` roughly tripled the font file
for axes the design never varies.

## SEO

- Metadata API on every route, with OpenGraph and Twitter cards.
- JSON-LD: `HairSalon` and `FAQPage` on `/`; `Service`, `FAQPage` and
  `BreadcrumbList` on each service page. Generated in `src/lib/jsonld.ts` from
  the same content files the pages render, so they cannot drift.
- `sitemap.ts` and `robots.ts` generate from the services array.
- Eight static service landing pages, each 600+ words.

## Measured results

Lighthouse, mobile, against a local production build (median of three runs):

| | Home | Service page |
| --- | --- | --- |
| Performance | 89 | 95 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |

CLS 0. Measured with photographic content in every slot, which is the honest
comparison — with flat gradient placeholders the same build scores 94, because
low-entropy images are cheap in a way real photographs are not.

Run-to-run spread on the sandbox used for these numbers was wide (85–92), so
treat performance as "about 89". The remaining headroom is Motion's bundle:
script evaluation is ~1s of the main-thread total, dwarfing everything else. If
performance ever needs to be bought, `LazyMotion` with a reduced feature set is
where to buy it.

Reported LCP is 2.9–3.4s under Lighthouse's *simulated* slow-4G throttling. The
same page measured in a real browser under 4× CPU throttling paints its largest
element in well under a second — the simulated figure models a dependency graph,
not an observation.

## Deployment

Vercel. **Root Directory must be set to `silq`** — this is a multi-project repo
and the default (repo root) builds a different app.

No environment variables are required at deploy time. `PEXELS_API_KEY` is only
needed locally when refreshing photography; the resulting images are committed,
so Vercel never needs the key.

Build command `next build`, output directory `.next`.
