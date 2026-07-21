# Nova Path Explorer — _Vive Dubái de una forma diferente._

A premium, cinematic, scroll-driven site for a private tours & travel concierge
company in Dubai / EAU serving **Spanish-speaking travellers**. Built to feel
like a boutique studio made it — warm, editorial, human.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**
- **React Three Fiber + drei** — the persistent "La Ruta" 3D background
- **Lenis** — smooth scroll; drives the route-drawing progress (0 → 1)
- **Framer Motion** — entrance choreography and card motion
- **lucide-react** — the minimal icon set

## The signature — "La Ruta"

One fixed, full-viewport `<Canvas>` sits behind all content (`z-0`,
`pointer-events:none`). As you scroll:

- a **dotted travel route** draws itself along a CatmullRom curve through 3D
  space (`src/components/scene/route.ts`);
- a low-poly **paper plane** (teal/white, orange underside) flies the route and
  banks into the curves;
- a **low-poly waypoint** (orange map-pin + an abstract landmark — arch, tower,
  dome, dune, sail, camera) appears as each section is reached;
- soft **dust particles** drift, and the **sky warms** from bright day toward
  golden hour.

Section backgrounds are transparent / translucent so the scene always reads
through. `prefers-reduced-motion` renders a static drawn route; mobile uses
fewer particles and a lower DPR cap.

## Content & images

- All copy lives in **`src/data/content.ts`**, typed and shaped so a future
  English translation can be layered without touching components.
- Section photography is fetched **server-side from Unsplash**
  (`src/lib/unsplash.ts`), keyed by the queries in **`src/data/images.ts`**.
  Set `UNSPLASH_ACCESS_KEY` in `.env.local` (see `.env.example`). **If the key
  is missing, cards fall back to tasteful brand gradients — never a broken
  image.** _TODO: replace with the client's own photography._
- The logo is a text lockup placeholder; drop the real file at
  **`/public/logo.png`** and it swaps in automatically.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```
