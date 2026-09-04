# syntax=docker/dockerfile:1

# BoloShop — API gateway image.
#
# BUILD CONTEXT IS THE MONOREPO ROOT, not this directory: the gateway depends
# on the `@boloshop/db` npm workspace, which lives at ../../packages/db and
# cannot be resolved from a context scoped to services/api-gateway.
#
#   docker build -f services/api-gateway/Dockerfile -t boloshop/api-gateway .
#
# (run from boloshop/ — docker-compose.yml does exactly this)

ARG NODE_IMAGE=node:22-alpine

# --- build ------------------------------------------------------------------
# Full workspace install, then compile TypeScript to dist/.

FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Manifests first so the install layer survives source edits. Every workspace
# manifest is needed: `npm ci` refuses to run against a lockfile whose
# workspaces are not all present on disk.
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/media-service/package.json ./services/media-service/
RUN npm ci

COPY packages/db ./packages/db
COPY services/api-gateway ./services/api-gateway

# `prebuild` builds @boloshop/db first — the gateway imports its .d.ts.
RUN npm run build --workspace @boloshop/api-gateway

# --- runtime ----------------------------------------------------------------
# A second, production-only install rather than pruning the build stage: it
# never carries a devDependency, and the workspace symlink
# node_modules/@boloshop/db -> ../packages/db is recreated here.

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/media-service/package.json ./services/media-service/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/packages/db/dist ./packages/db/dist
# migrate.js resolves ../migrations relative to itself, so the SQL ships too:
# this image doubles as the one-shot migration runner (see docker-compose.yml).
COPY packages/db/migrations ./packages/db/migrations
COPY --from=build /app/services/api-gateway/dist ./services/api-gateway/dist

USER node
EXPOSE 4000

# No curl or wget dependency: Node 22 has a global fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/services/api-gateway
CMD ["node", "dist/index.js"]
