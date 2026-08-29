// Package teambuy implements Pinduoduo-style group buying: a buyer opens a
// team purchase on their pending order, shares the link, and whoever joins
// inside the window unlocks a discount for both of them.
package teambuy

import (
	"time"
)

// Status values mirror the team_purchase_status enum in the database.
const (
	StatusPendingJoin = "pending_join"
	StatusCompleted   = "completed"
	StatusExpired     = "expired"
)

// Discount bounds. A team buy has to be worth telling a friend about and still
// leave the seller a margin, so the band is fixed rather than free-form.
const (
	MinDiscountPct = 20
	MaxDiscountPct = 30
	// DefaultDiscountPct applies when the caller does not name one.
	DefaultDiscountPct = 25
)

// TeamPurchase is a row of the team_purchases table as this service returns it.
type TeamPurchase struct {
	ID        string  `json:"id"`
	OrderID   string  `json:"order_id"`
	InviterID string  `json:"inviter_id"`
	InviteeID *string `json:"invitee_id"`
	Status    string  `json:"status"`
	// DiscountPct is NUMERIC(5,2) in Postgres, carried as a string like the
	// money fields so it survives the round trip exactly.
	DiscountPct string    `json:"discount_applied_pct"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// ExpiresAt is derived, not stored: the schema has no expiry column, so the
	// window is created_at plus the configured duration. Adding the column
	// later would not change this API.
	ExpiresAt time.Time `json:"expires_at"`
	// SecondsRemaining is what a countdown timer in the app renders. Zero once
	// the window has closed.
	SecondsRemaining int `json:"seconds_remaining"`
}

// expiresAt is the close of the join window for a team purchase created at
// createdAt.
func expiresAt(createdAt time.Time, window time.Duration) time.Time {
	return createdAt.Add(window)
}

// decorate fills in the derived expiry fields, relative to the database's
// clock rather than this process's.
func decorate(tp *TeamPurchase, now time.Time, window time.Duration) {
	tp.ExpiresAt = expiresAt(tp.CreatedAt, window)

	remaining := tp.ExpiresAt.Sub(now)
	if remaining < 0 || tp.Status != StatusPendingJoin {
		tp.SecondsRemaining = 0
		return
	}
	tp.SecondsRemaining = int(remaining.Seconds())
}

// isExpired reports whether the join window has closed. Only a pending_join
// row can expire; a completed one is done.
func isExpired(tp TeamPurchase, now time.Time, window time.Duration) bool {
	return tp.Status == StatusPendingJoin && !now.Before(expiresAt(tp.CreatedAt, window))
}
