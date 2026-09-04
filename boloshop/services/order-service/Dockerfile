# syntax=docker/dockerfile:1

# BoloShop — order and logistics service (Go).
#
# Self-contained: the build context is THIS directory.
#
#   docker build -t boloshop/order-service services/order-service

ARG GO_IMAGE=golang:1.24-alpine
ARG RUNTIME_IMAGE=alpine:latest

# --- build ------------------------------------------------------------------

FROM ${GO_IMAGE} AS build
WORKDIR /src

# Modules first: this layer only changes when go.mod/go.sum do.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Static binary — the runner has no libc toolchain and no cgo dependencies.
# -trimpath keeps build paths out of the binary; -s -w drops the symbol table.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
      -o /out/order-service ./cmd/server

# --- runtime ----------------------------------------------------------------

FROM ${RUNTIME_IMAGE} AS runtime

# ca-certificates is needed for TLS to a managed Postgres (sslmode=require).
# wget for the health probe comes from busybox, already in the base image.
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -H -u 10001 boloshop

COPY --from=build /out/order-service /usr/local/bin/order-service

ENV PORT=4002

USER boloshop
EXPOSE 4002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["order-service"]
