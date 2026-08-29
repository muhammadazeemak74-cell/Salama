# @boloshop/media-service

Turns product photos into a vertical promo video. A seller uploads up to three
images with a title and a price; the service renders a 15-second 1080x1920 MP4
with a Ken Burns move across each photo and the title, price and a BoloShop
badge drawn on top.

## Layout

```
src/index.ts              startup: storage, dependency report, graceful shutdown
src/app.ts                Express app: helmet, CORS, static renders, errors
src/config.ts             environment, read once at boot
src/services/ffmpeg.ts    binary probe + the render pipeline and filtergraph
src/services/credits.ts   seller lookup (real) + AI video credits (mocked)
src/services/jobs.ts      render job registry
src/routes/video.ts       render-promo, job polling, health
src/middleware/error.ts   404 + centralized error handler
```

## Running

```bash
cp .env.example .env
npm run build --workspace @boloshop/media-service
npm run start --workspace @boloshop/media-service
```

Build and typecheck work from a clean checkout here or at the repo root — a
`prebuild` / `pretypecheck` hook builds `@boloshop/db` first, since this package
compiles against its emitted `.d.ts`.

**FFmpeg is a runtime dependency, not an npm one.** Install it on the host
(`apt-get install ffmpeg`, `brew install ffmpeg`) or point `FFMPEG_PATH` at a
binary. Without it the service still starts and serves `/health`; renders
return a 503 that names what is missing.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/media/render-promo` | multipart: 1–3 `images` + `seller_id`, `title`, `price_pkr` |
| GET | `/api/v1/media/jobs/:id` | poll a render |
| GET | `/api/v1/media/health` | service, FFmpeg, font and database status |
| GET | `/media/renders/:file.mp4` | the finished video |

```bash
curl -X POST http://localhost:4001/api/v1/media/render-promo \
  -F seller_id=$SELLER_ID \
  -F "title=3-Piece Unstitched Lawn Suit" \
  -F price_pkr=4499.50 \
  -F images=@front.jpg -F images=@back.jpg -F images=@detail.jpg
```

Rendering takes ~15 seconds of CPU for a 15-second video, which is far too long
to hold an HTTP request open on a mobile connection, so the endpoint returns
**202** with a job id and the URL the video *will* have. Poll `status_url` until
the job reports `completed` or `failed` — the file does not exist before that.

Errors use the same shape as the API gateway, so a client handles both the same
way:

| Status | When |
| --- | --- |
| 400 | no images, too many, or bad metadata |
| 402 | the seller is out of AI video credits |
| 404 | unknown seller or unknown job |
| 413 | an image over `MAX_IMAGE_BYTES` |
| 415 | a file that is not JPEG, PNG or WebP |
| 503 | FFmpeg or the overlay font is unavailable on this host |

## The render pipeline

FFmpeg is driven through `child_process.spawn`, not fluent-ffmpeg. The graph is
a hand-built `-filter_complex` with per-input `zoompan` chains feeding a
`concat` — the shape fluent's builder gets in the way of — and spawning argv
with no shell means a product title can never reach a command line.

Per image: cover-crop to twice the output size, then `zoompan`. The upscale is
what makes the move smooth; `zoompan` positions on integer input pixels, so
panning a 1080-wide source steps visibly while a 2160-wide one does not.
Direction alternates (in, out, in) so a three-photo promo is not the same move
three times. Frame counts are computed to sum to exactly `15s x 30fps = 450`,
whatever the image count.

Overlay copy is passed to `drawtext` via `textfile=`, never inline. Product
titles are user input, and a filename in a filtergraph needs no escaping while
arbitrary text very much does. Titles are wrapped to two lines and ellipsised;
`drawtext` does no wrapping of its own.

Output is H.264 high@4.1, yuv420p, with `+faststart` so playback begins before
the whole file arrives — the difference between usable and not on a 3G link.

## ⚠ Before this serves real traffic

1. **Credit balances are mocked.** The seller lookup is real, against the
   `sellers` table. The balance is in-memory and starts at
   `MOCK_VIDEO_CREDITS_PER_SELLER`, because the schema has no credits column
   yet. `src/services/credits.ts` carries the migration and the guarded
   `UPDATE` that replace it.
2. **Job state is in-memory.** A job created on pod A cannot be polled from pod
   B, and a restart loses every job. This wants Redis, which the architecture
   already calls for, before running more than one instance.
3. **Renders are stored on local disk.** Fine for one box; move `renders/` to
   object storage and set `PUBLIC_BASE_URL` to the CDN before scaling out.
4. **Rendering runs in the request process.** One render saturates a core for
   its whole duration. Move it to a worker pool or a queue before concurrency
   matters.
5. **Urdu titles will not shape correctly.** `drawtext` renders a glyph run
   left to right with no complex-script shaping, so Arabic-script text comes out
   disjoint and in the wrong order. `products.title` is usually Roman Urdu or
   English, so this is survivable now; rendering `description_urdu` means
   switching the overlay to libass (`subtitles`/`ass` filter) with a
   Nastaliq-capable font.
