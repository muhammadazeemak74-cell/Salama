# Scene footage

Drop your four Dubai clips here, named exactly:

- `scene-1.mp4` — Dubai aerial skyline (hero)
- `scene-2.mp4` — desert dunes ("Experiencias")
- `scene-3.mp4` — marina / yacht ("A tu medida")
- `scene-4.mp4` — landmark / night ("Tu llegada")

Then run `npm run extract:frames` (or just `npm run build`, which runs it first).
Frames are written to `public/frames/` (git-ignored, regenerated on every build,
including on Vercel). Keep each clip under ~95 MB.

If a clip is missing, that chapter gracefully renders a full-bleed Unsplash
still with the same cinematic title — never a broken scene.
