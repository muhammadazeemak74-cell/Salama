# ONYX — Arrive in black.

A cinematic, scroll-driven landing page for a luxury chauffeur & car service
in Dubai. Next.js (App Router) + TypeScript + Tailwind, with a persistent
React Three Fiber crystal scene, Lenis smooth scroll, and Framer Motion
scroll choreography.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- `@react-three/fiber` + `@react-three/drei` — the background crystal scene
- `lenis` — smooth scroll, drives the crystal's scroll progress
- `framer-motion` — entrance animations, card tilt, header reveal

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Content

Fleet, services, rental tiers and site copy (WhatsApp number, phone, hours,
etc.) live in `src/data/*.ts` — edit there rather than in the components.

Placeholder photography is centralized in `src/data/images.ts` (loremflickr,
pinned per car so images stay stable). Swap for real shoot assets there.

## Notes

- The 3D crystal's reflections are generated procedurally (`Lightformer`s in
  `BackgroundScene.tsx`) rather than from a fetched HDR, so the scene never
  depends on an external asset CDN being reachable.
- Respects `prefers-reduced-motion` (static crystal, no scroll-driven camera
  drift) and reduces particle count / environment resolution on mobile.
