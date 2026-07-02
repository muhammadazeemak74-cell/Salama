# NOOR — Arrive in light.

A cinematic, scroll-driven landing page for a luxury chauffeur & fleet
service in Dubai. Next.js (App Router) + TypeScript + Tailwind, with a
persistent React Three Fiber light-route scene, Lenis smooth scroll, and
Framer Motion scroll choreography.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing` —
  the background light-route scene (TubeGeometry route, streaming particles,
  particle skyline, Bloom on desktop)
- `lenis` — smooth scroll, drives the route's scroll progress
- `framer-motion` — entrance animations, card tilt, header reveal

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Content

Fleet, services, and rental tiers live in `src/data/*.ts` — edit there
rather than in the components. Site copy (WhatsApp number, phone, rating,
coverage, etc.) lives in `src/data/site.ts`.

## Images

Fleet, arrival, and Instagram-strip photography is fetched server-side from
Unsplash (`src/lib/unsplash.ts`), keyed by `UNSPLASH_ACCESS_KEY` (see
`.env.example`). If the key is missing or a fetch fails, cards fall back to
a tasteful gradient placeholder (`src/components/ui/GradientFallback.tsx`)
instead of a broken image. **TODO:** replace with the client's own fleet
photography before launch.

## Notes

- Respects `prefers-reduced-motion` (static scene, no scroll-driven camera
  movement) and drops particle count / skips Bloom postprocessing on mobile.
- Streaming particles are placed at fixed positions along the route; the
  "streaming" effect comes from the camera moving past them, not per-frame
  position updates — cheap and reads correctly at speed.
- Particle geometry uses a seeded PRNG (`src/lib/seeded-random.ts`) rather
  than `Math.random()` directly, so component render stays pure.
