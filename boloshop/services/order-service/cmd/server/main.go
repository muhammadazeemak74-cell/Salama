// Command server is the BoloShop order and logistics microservice.
//
// It owns the order lifecycle — creation with the 1% platform commission,
// courier tracking, and Pinduoduo-style team purchases — over the same
// PostgreSQL schema the Node services use.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"boloshop/order-service/internal/config"
	"boloshop/order-service/internal/health"
	"boloshop/order-service/internal/orders"
	"boloshop/order-service/internal/teambuy"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(logger); err != nil {
		logger.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Signals cancel this context, which unwinds the whole startup path — so
	// a Ctrl-C during a slow database connect exits promptly.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := openPool(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	logger.Info("database reachable", "max_conns", cfg.MaxConns)

	mux := http.NewServeMux()
	health.NewHandler(logger, pool).Register(mux)
	orders.NewHandler(logger, pool, cfg).Register(mux)
	teambuy.NewHandler(logger, pool, cfg).Register(mux)

	server := &http.Server{
		Addr:    cfg.Addr(),
		Handler: requestLogger(logger, mux),
		// A slow client must not be able to hold a connection open forever.
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		// Slightly above the 60s a typical load balancer holds a keep-alive,
		// so the proxy closes idle connections first.
		IdleTimeout: 65 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", cfg.Addr(), "team_buy_window", cfg.TeamBuyWindow.String())
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
			return
		}
		serverErr <- nil
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		logger.Info("signal received, shutting down")
	}

	// Stop trapping signals: a second Ctrl-C should kill a hung shutdown
	// rather than being swallowed.
	stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		// In-flight requests outlasted the grace period; close hard so the
		// process still exits.
		logger.Error("graceful shutdown timed out, closing connections", "error", err)
		_ = server.Close()
	}

	logger.Info("shutdown complete")
	return nil
}

// openPool builds the connection pool and proves the database is reachable
// before the port is bound, so a pod with a bad DATABASE_URL fails at boot
// instead of serving errors.
func openPool(ctx context.Context, cfg config.Config) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	poolCfg.MaxConns = cfg.MaxConns
	poolCfg.MaxConnIdleTime = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}

// statusRecorder remembers the status code so the access log can report it.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// requestLogger emits one structured line per request.
func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(recorder, r)

		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"duration_ms", float64(time.Since(started).Microseconds())/1000,
		)
	})
}
