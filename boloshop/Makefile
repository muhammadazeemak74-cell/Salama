# BoloShop monorepo orchestration.
#
#   make            list the targets
#   make build      compile everything
#   make test       run every test suite
#   make dev        run all three services locally
#
# Four toolchains live here — npm/TypeScript, Go, Flutter, and Postgres — so
# every target names which one it needs and fails with a readable message
# rather than "command not found" when it is missing. The per-language targets
# (build-ts, build-go, build-mobile) exist so a backend developer with no
# Flutter SDK can still build the half they work on.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

# Override any of these on the command line, e.g. FLUTTER=/opt/flutter/bin/flutter
NPM     ?= npm
GO      ?= go
FLUTTER ?= flutter
PSQL    ?= psql

MOBILE := apps/mobile
ORDER  := services/order-service

GATEWAY_PORT ?= 4000
MEDIA_PORT   ?= 4001
ORDER_PORT   ?= 4002

# Fails with an actionable message when a toolchain is absent.
define require_tool
	@command -v $(1) >/dev/null 2>&1 || { \
		printf '\n  %s is required but was not found on PATH.\n  %s\n\n' "$(1)" "$(2)"; \
		exit 1; \
	}
endef

define require_env
	@[ -n "$${$(1):-}" ] || { \
		printf '\n  $(1) is not set.\n  %s\n\n' "$(2)"; \
		exit 1; \
	}
endef

define banner
	@printf '\n\033[1;36m==> %s\033[0m\n' "$(1)"
endef

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## List the targets
	@printf '\nBoloShop — make targets\n\n'
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@printf '\nPorts: gateway $(GATEWAY_PORT), media $(MEDIA_PORT), order $(ORDER_PORT)\n\n'

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

.PHONY: install
install: install-ts install-go install-mobile ## Install every dependency

.PHONY: install-ts
install-ts:
	$(call banner,npm install)
	$(NPM) install

.PHONY: install-go
install-go:
	$(call banner,go mod download)
	cd $(ORDER) && $(GO) mod download

.PHONY: install-mobile
install-mobile:
	$(call banner,flutter pub get)
	cd $(MOBILE) && $(FLUTTER) pub get

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

.PHONY: build
build: build-ts build-go build-mobile ## Compile TypeScript, Go and Flutter
	@printf '\n\033[1;32m==> build complete\033[0m\n\n'

.PHONY: build-ts
build-ts: ## Compile @boloshop/db, api-gateway and media-service
	$(call require_tool,$(NPM),Install Node 20+ from https://nodejs.org)
	$(call banner,TypeScript)
	$(NPM) run build

.PHONY: build-go
build-go: ## Compile the order service
	$(call require_tool,$(GO),Install Go 1.24+ from https://go.dev/dl)
	$(call banner,Go — order-service)
	cd $(ORDER) && $(GO) build ./...

# `flutter analyze` is the compile-equivalent check: it runs the full analyzer
# over the app and fails on any error. Producing an installable artifact needs
# the Android SDK or Xcode, which most machines here will not have — that is
# `make mobile-apk` / `make mobile-ipa`, kept separate on purpose so a missing
# platform SDK cannot fail the whole monorepo build.
.PHONY: build-mobile
build-mobile: ## Analyze the Flutter app (compile check)
	$(call require_tool,$(FLUTTER),Install Flutter from https://docs.flutter.dev/get-started/install)
	$(call banner,Flutter — analyze)
	cd $(MOBILE) && $(FLUTTER) analyze

.PHONY: mobile-apk
mobile-apk: ## Build a debug APK (needs the Android SDK)
	$(call require_tool,$(FLUTTER),Install Flutter from https://docs.flutter.dev/get-started/install)
	$(call banner,Flutter — debug APK)
	cd $(MOBILE) && $(FLUTTER) build apk --debug

.PHONY: mobile-ipa
mobile-ipa: ## Build for iOS without signing (needs Xcode, macOS only)
	$(call require_tool,$(FLUTTER),Install Flutter from https://docs.flutter.dev/get-started/install)
	$(call banner,Flutter — iOS)
	cd $(MOBILE) && $(FLUTTER) build ios --no-codesign

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

.PHONY: test
test: test-ts test-go test-mobile ## Run every test suite
	@printf '\n\033[1;32m==> tests complete\033[0m\n\n'

# Jest, via each workspace's own test script. @boloshop/db still has none —
# its behaviour is the migration runner and the pool, both of which need a real
# Postgres, so it is covered by `make db-migrate` against a live database
# rather than by unit tests.
.PHONY: test-ts
test-ts: ## Run the api-gateway and media-service Jest suites
	$(call require_tool,$(NPM),Install Node 20+ from https://nodejs.org)
	$(call banner,TypeScript tests)
	$(NPM) test

.PHONY: test-go
test-go: ## Run the order service tests
	$(call require_tool,$(GO),Install Go 1.24+ from https://go.dev/dl)
	$(call banner,Go tests)
	cd $(ORDER) && $(GO) test ./...

.PHONY: test-mobile
test-mobile: ## Run the Flutter unit and widget tests
	$(call require_tool,$(FLUTTER),Install Flutter from https://docs.flutter.dev/get-started/install)
	$(call banner,Flutter tests)
	cd $(MOBILE) && $(FLUTTER) test

# ---------------------------------------------------------------------------
# Lint, format, typecheck
# ---------------------------------------------------------------------------

.PHONY: check
check: typecheck lint test ## Everything CI should run

.PHONY: typecheck
typecheck: ## Typecheck TypeScript and analyze Dart
	$(call banner,typecheck)
	$(NPM) run typecheck
	cd $(MOBILE) && $(FLUTTER) analyze

.PHONY: lint
lint: ## go vet, gofmt and dart format checks
	$(call banner,lint)
	cd $(ORDER) && $(GO) vet ./...
	@cd $(ORDER) && unformatted=$$(gofmt -l .); \
		if [ -n "$$unformatted" ]; then \
			printf '  these Go files need gofmt:\n%s\n' "$$unformatted"; exit 1; \
		fi; \
		printf '  gofmt: clean\n'
	cd $(MOBILE) && dart format --output=none --set-exit-if-changed lib test

.PHONY: fmt
fmt: ## Rewrite sources with gofmt and dart format
	cd $(ORDER) && gofmt -w .
	cd $(MOBILE) && dart format lib test

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

.PHONY: db-migrate
db-migrate: ## Apply pending Postgres migrations
	$(call require_env,DATABASE_URL,Set it to your Postgres connection string — see packages/db/.env.example)
	$(call banner,migrate)
	$(NPM) run migrate --workspace @boloshop/db

.PHONY: db-status
db-status: ## Show applied and pending migrations
	$(call require_env,DATABASE_URL,Set it to your Postgres connection string — see packages/db/.env.example)
	$(NPM) run migrate:status --workspace @boloshop/db

.PHONY: db-psql
db-psql: ## Open psql against DATABASE_URL
	$(call require_tool,$(PSQL),Install the PostgreSQL client tools)
	$(call require_env,DATABASE_URL,Set it to your Postgres connection string)
	$(PSQL) "$$DATABASE_URL"

# ---------------------------------------------------------------------------
# Dev servers
# ---------------------------------------------------------------------------

# All three run in one process group with a shared trap, so Ctrl-C stops the
# whole stack instead of leaving two services holding their ports. @boloshop/db
# is built first because the two Node services import its emitted .d.ts and
# .js, not its sources.
#
# `wait -n` returns as soon as ANY of the three exits, and the trap then stops
# the rest. Plain `wait` would sit there while the survivors kept serving, so a
# crashed service looks like a working stack until someone curls the port it
# was meant to be on. (The Node services run under `node --watch`, which
# restarts them in place after a crash, so this fires on a real exit rather
# than on a reload.)
#
# sed gets -u because it block-buffers when its stdout is not a terminal:
# without it `make dev | tee dev.log` shows nothing at all until a service
# stops.
#
# The recipe is prefixed with `-` so make ignores its exit status. `kill 0` is
# what actually cleans up: killing the subshells alone would orphan the node
# and go processes underneath them, but it takes down the whole process group,
# make included, so make reports the recipe as killed by a signal. With the `-`
# that becomes one "(ignored)" line on shutdown instead of a `*** Error`, which
# is the right trade for a target whose normal exit is Ctrl-C.
.PHONY: dev
dev: ## Run gateway (4000), media (4001) and order (4002) together
	$(call require_env,DATABASE_URL,Set it to your Postgres connection string — see packages/db/.env.example)
	$(call require_env,JWT_SECRET,The gateway refuses to start without it. Generate one: openssl rand -base64 48)
	$(call banner,building @boloshop/db first)
	$(NPM) run build --workspace @boloshop/db
	@printf '\n\033[1;36m==> gateway :$(GATEWAY_PORT)  media :$(MEDIA_PORT)  order :$(ORDER_PORT)   (Ctrl-C stops all)\033[0m\n\n'
	@-trap 'kill 0' EXIT INT TERM; \
		( cd services/api-gateway  && PORT=$(GATEWAY_PORT) $(NPM) run dev 2>&1 | sed -u 's/^/[gateway] /' ) & \
		( cd services/media-service && PORT=$(MEDIA_PORT)  $(NPM) run dev 2>&1 | sed -u 's/^/[media]   /' ) & \
		( cd $(ORDER)               && PORT=$(ORDER_PORT)  $(GO) run ./cmd/server 2>&1 | sed -u 's/^/[order]   /' ) & \
		wait -n; \
		printf '\n\033[1;33m  a service exited — stopping the other two\033[0m\n\n'

.PHONY: dev-gateway
dev-gateway: ## Run only the API gateway
	cd services/api-gateway && PORT=$(GATEWAY_PORT) $(NPM) run dev

.PHONY: dev-media
dev-media: ## Run only the media service
	cd services/media-service && PORT=$(MEDIA_PORT) $(NPM) run dev

.PHONY: dev-order
dev-order: ## Run only the order service
	cd $(ORDER) && PORT=$(ORDER_PORT) $(GO) run ./cmd/server

.PHONY: dev-mobile
dev-mobile: ## Run the Flutter app against the local services
	cd $(MOBILE) && $(FLUTTER) run \
		--dart-define=GATEWAY_BASE_URL=http://localhost:$(GATEWAY_PORT) \
		--dart-define=ORDER_SERVICE_BASE_URL=http://localhost:$(ORDER_PORT)

# The counterpart to `make dev`, for when it was started in another terminal
# or left something behind. SIGTERM first so the services run their graceful
# shutdown — draining in-flight requests and closing the pool — and SIGKILL
# only for whatever ignores it.
.PHONY: stop
stop: ## Kill whatever is holding the dev ports
	$(call require_tool,lsof,Install lsof, or stop the services from the terminal running `make dev`)
	@pids=$$(lsof -ti:$(GATEWAY_PORT),$(MEDIA_PORT),$(ORDER_PORT) 2>/dev/null || true); \
		if [ -z "$$pids" ]; then \
			printf '  ports $(GATEWAY_PORT), $(MEDIA_PORT), $(ORDER_PORT) are already free\n'; \
		else \
			printf '  stopping: %s\n' "$$pids"; \
			kill $$pids 2>/dev/null || true; \
			sleep 2; \
			remaining=$$(lsof -ti:$(GATEWAY_PORT),$(MEDIA_PORT),$(ORDER_PORT) 2>/dev/null || true); \
			if [ -n "$$remaining" ]; then \
				printf '  still up after SIGTERM, forcing: %s\n' "$$remaining"; \
				kill -9 $$remaining 2>/dev/null || true; \
			fi; \
			printf '  stopped\n'; \
		fi

.PHONY: health
health: ## Curl every service's health endpoint
	@printf '\n'
	@for url in \
		"http://localhost:$(GATEWAY_PORT)/health" \
		"http://localhost:$(MEDIA_PORT)/api/v1/media/health" \
		"http://localhost:$(ORDER_PORT)/health"; do \
			code=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$$url" || echo "---"); \
			printf '  %-48s %s\n' "$$url" "$$code"; \
		done
	@printf '\n'

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

.PHONY: clean
clean: ## Remove build output from every workspace
	rm -rf packages/db/dist services/api-gateway/dist services/media-service/dist
	rm -rf $(ORDER)/bin $(ORDER)/coverage.out
	cd $(MOBILE) && $(FLUTTER) clean >/dev/null 2>&1 || true
	@printf '  cleaned\n'
