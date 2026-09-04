// Package health serves the liveness and readiness probe.
package health

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"boloshop/order-service/internal/httpx"
)

// Handler serves GET /health.
type Handler struct {
	logger    *slog.Logger
	pool      *pgxpool.Pool
	startedAt time.Time
}

// NewHandler wires a handler to the pool.
func NewHandler(logger *slog.Logger, pool *pgxpool.Pool) *Handler {
	return &Handler{logger: logger, pool: pool, startedAt: time.Now()}
}

// Register mounts the health route. It is unversioned on purpose:
// infrastructure probes it, not the app.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("GET /health", httpx.Handle(h.logger, h.get))
}

type checkResult struct {
	Status    string  `json:"status"`
	LatencyMS float64 `json:"latency_ms"`
	Error     string  `json:"error,omitempty"`
}

type response struct {
	Status        string `json:"status"`
	Service       string `json:"service"`
	Timestamp     string `json:"timestamp"`
	UptimeSeconds int    `json:"uptime_seconds"`
	Checks        struct {
		Database checkResult `json:"database"`
	} `json:"checks"`
}

// pingTimeout bounds the readiness check. A probe that hangs is a probe that
// stops a load balancer from routing around the problem.
const pingTimeout = 2 * time.Second

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	ctx, cancel := context.WithTimeout(r.Context(), pingTimeout)
	defer cancel()

	started := time.Now()
	pingErr := h.pool.Ping(ctx)
	latency := float64(time.Since(started).Microseconds()) / 1000

	resp := response{
		Service:       "order-service",
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		UptimeSeconds: int(time.Since(h.startedAt).Seconds()),
	}
	resp.Checks.Database = checkResult{
		Status:    "ok",
		LatencyMS: latency,
	}

	status := http.StatusOK
	resp.Status = "ok"

	if pingErr != nil {
		resp.Status = "degraded"
		resp.Checks.Database.Status = "error"
		resp.Checks.Database.Error = pingErr.Error()
		// 503 so a load balancer drains this pod instead of the pod having to
		// exit and lose its warm state.
		status = http.StatusServiceUnavailable
	}

	// A health reading is a point in time; never let a proxy cache it.
	w.Header().Set("Cache-Control", "no-store")
	httpx.WriteJSON(h.logger, w, status, resp)
	return nil
}
