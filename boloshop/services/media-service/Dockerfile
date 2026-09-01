# syntax=docker/dockerfile:1

# BoloShop — media service image (FFmpeg promo renderer).
#
# BUILD CONTEXT IS THE MONOREPO ROOT, not this directory: the service depends
# on the `@boloshop/db` npm workspace at ../../packages/db.
#
#   docker build -f services/media-service/Dockerfile -t boloshop/media-service .
#
# (run from boloshop/ — docker-compose.yml does exactly this)

ARG NODE_IMAGE=node:22-alpine

# src/config.ts probes the Debian font locations, so a bare Alpine install
# leaves it with no font at all: the drawtext overlay is skipped, /health
# reports degraded and every render returns 503. The install below links
# whichever path apk actually used to this one, so the app finds the font
# whether or not FONT_PATH is passed through.
ARG FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf

# --- build ------------------------------------------------------------------

FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/media-service/package.json ./services/media-service/
RUN npm ci

COPY packages/db ./packages/db
COPY services/media-service ./services/media-service

# `prebuild` builds @boloshop/db first — the service imports its .d.ts.
RUN npm run build --workspace @boloshop/media-service

# --- runtime ----------------------------------------------------------------

FROM ${NODE_IMAGE} AS runtime
ARG FONT_PATH
WORKDIR /app

# ffmpeg carries ffprobe; font-dejavu is what drawtext renders the price and
# title overlays with. Both are asserted present, so a base-image change that
# drops or moves them fails the build rather than the first render.
RUN apk add --no-cache ffmpeg font-dejavu fontconfig \
    && ffmpeg -version > /dev/null \
    && ffprobe -version > /dev/null \
    && font="$(find /usr/share/fonts -name 'DejaVuSans-Bold.ttf' -print -quit)" \
    && if [ -z "$font" ]; then font="$(fc-match -f '%{file}' 'DejaVu Sans:bold')"; fi \
    && test -f "$font" \
    && if [ "$font" != "${FONT_PATH}" ]; then \
         mkdir -p "$(dirname "${FONT_PATH}")" && ln -sf "$font" "${FONT_PATH}"; \
       fi \
    && test -f "${FONT_PATH}"

ENV NODE_ENV=production \
    PORT=4001 \
    MEDIA_STORAGE_PATH=/app/uploads \
    FFMPEG_PATH=ffmpeg \
    FFPROBE_PATH=ffprobe \
    FONT_PATH=${FONT_PATH}

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/media-service/package.json ./services/media-service/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/services/media-service/dist ./services/media-service/dist

# Multer writes uploads/incoming and FFmpeg writes uploads/renders, so this
# must be writable by the unprivileged user. Mount a volume over it to keep
# finished MP4s across a container replacement.
RUN mkdir -p /app/uploads/incoming /app/uploads/renders && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4001)+'/api/v1/media/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/services/media-service
CMD ["node", "dist/index.js"]
