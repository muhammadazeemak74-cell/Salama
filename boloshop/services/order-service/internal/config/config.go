// Package config reads the service's settings from the environment once, at
// startup, so a misconfiguration is a boot failure rather than a surprise on
// the first request that happens to need the value.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds everything the service reads from the environment.
type Config struct {
	Port        int
	DatabaseURL string

	// MaxConns caps the pool. Postgres does not enjoy thousands of
	// connections, and an order request is short.
	MaxConns int32

	// TeamBuyWindow is how long a team purchase stays joinable. Pinduoduo-style
	// group buys live or die on urgency; 24 hours is the default.
	TeamBuyWindow time.Duration

	// TeamBuyBaseURL prefixes the shareable team purchase link.
	TeamBuyBaseURL string

	// WhatsAppTemplate is the confirmation message body. {{...}} placeholders
	// are filled in by the orders package.
	WhatsAppTemplate string

	ShutdownTimeout time.Duration
}

// Load reads the environment. The only required variable is DATABASE_URL.
func Load() (Config, error) {
	cfg := Config{
		Port:             4002,
		MaxConns:         10,
		TeamBuyWindow:    24 * time.Hour,
		TeamBuyBaseURL:   "https://boloshop.pk/team",
		ShutdownTimeout:  10 * time.Second,
		WhatsAppTemplate: defaultWhatsAppTemplate,
	}

	cfg.DatabaseURL = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required (see .env.example)")
	}

	if raw := strings.TrimSpace(os.Getenv("PORT")); raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil || port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("PORT must be a valid port number, got %q", raw)
		}
		cfg.Port = port
	}

	if raw := strings.TrimSpace(os.Getenv("PGPOOL_MAX")); raw != "" {
		maxConns, err := strconv.Atoi(raw)
		if err != nil || maxConns < 1 {
			return Config{}, fmt.Errorf("PGPOOL_MAX must be a positive integer, got %q", raw)
		}
		cfg.MaxConns = int32(maxConns)
	}

	if raw := strings.TrimSpace(os.Getenv("TEAM_BUY_WINDOW_HOURS")); raw != "" {
		hours, err := strconv.Atoi(raw)
		if err != nil || hours < 1 {
			return Config{}, fmt.Errorf("TEAM_BUY_WINDOW_HOURS must be a positive integer, got %q", raw)
		}
		cfg.TeamBuyWindow = time.Duration(hours) * time.Hour
	}

	if raw := strings.TrimSpace(os.Getenv("TEAM_BUY_BASE_URL")); raw != "" {
		cfg.TeamBuyBaseURL = strings.TrimRight(raw, "/")
	}

	if raw := os.Getenv("WHATSAPP_TEMPLATE"); strings.TrimSpace(raw) != "" {
		cfg.WhatsAppTemplate = raw
	}

	return cfg, nil
}

// Addr is the listen address for the HTTP server.
func (c Config) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}

const defaultWhatsAppTemplate = "Assalam-o-Alaikum {{store}}! " +
	"I have placed order {{order_short_id}} on BoloShop for {{amount}}. " +
	"Please confirm and share the delivery time. Shukriya!"
