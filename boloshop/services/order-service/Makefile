# BoloShop order & logistics service.
#
# `make` on its own runs the full local check: format, vet, build, test.

BINARY := bin/order-service
PKGS   := ./...

.DEFAULT_GOAL := check

.PHONY: check
check: fmt-check vet build test ## Run every local check (default)

.PHONY: build
build: ## Compile every package
	go build $(PKGS)

.PHONY: binary
binary: ## Build the server binary into bin/
	@mkdir -p $(dir $(BINARY))
	go build -o $(BINARY) ./cmd/server

.PHONY: run
run: ## Run the server (needs DATABASE_URL)
	go run ./cmd/server

.PHONY: test
test: ## Run the unit tests
	go test $(PKGS)

.PHONY: test-race
test-race: ## Run the tests under the race detector
	go test -race $(PKGS)

.PHONY: cover
cover: ## Run tests and print per-function coverage
	go test -coverprofile=coverage.out $(PKGS)
	go tool cover -func=coverage.out

.PHONY: vet
vet: ## Run go vet, the built-in static checks
	go vet $(PKGS)

.PHONY: fmt
fmt: ## Rewrite sources with gofmt
	gofmt -w .

.PHONY: fmt-check
fmt-check: ## Fail if anything is not gofmt-clean
	@unformatted=$$(gofmt -l .); \
	if [ -n "$$unformatted" ]; then \
		echo "These files need gofmt:"; echo "$$unformatted"; exit 1; \
	fi
	@echo "gofmt: clean"

.PHONY: tidy
tidy: ## Prune and verify go.mod / go.sum
	go mod tidy
	go mod verify

.PHONY: clean
clean: ## Remove build artefacts
	rm -rf bin coverage.out

.PHONY: help
help: ## List the targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
