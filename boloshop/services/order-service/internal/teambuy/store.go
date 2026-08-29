package teambuy

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"boloshop/order-service/internal/orders"
)

// ErrNotFound is returned when a row the caller named does not exist.
var ErrNotFound = errors.New("not found")

// Store is the teambuy package's database access.
type Store struct {
	pool   *pgxpool.Pool
	window time.Duration
}

// NewStore wraps a pool. window is how long a team purchase stays joinable.
func NewStore(pool *pgxpool.Pool, window time.Duration) *Store {
	return &Store{pool: pool, window: window}
}

const teamPurchaseColumns = `id,
	order_id,
	inviter_id,
	invitee_id,
	status,
	discount_applied_pct::text,
	created_at,
	updated_at`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanTeamPurchase(row rowScanner) (TeamPurchase, error) {
	var tp TeamPurchase
	err := row.Scan(
		&tp.ID,
		&tp.OrderID,
		&tp.InviterID,
		&tp.InviteeID,
		&tp.Status,
		&tp.DiscountPct,
		&tp.CreatedAt,
		&tp.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return TeamPurchase{}, ErrNotFound
	}
	if err != nil {
		return TeamPurchase{}, fmt.Errorf("scan team purchase: %w", err)
	}
	return tp, nil
}

// OrderSummary is the little the teambuy package needs to know about an order.
type OrderSummary struct {
	ID      string
	BuyerID string
	Status  string
}

// CreateInput describes a team purchase to open.
type CreateInput struct {
	OrderID     string
	InviterID   string
	DiscountPct string
}

// Create opens a team purchase on a pending order.
//
// The whole thing runs in one transaction with the order locked, so two taps
// on "invite a friend" cannot open two competing teams on the same order.
func (s *Store) Create(ctx context.Context, in CreateInput) (TeamPurchase, time.Time, error) {
	var zero time.Time

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return TeamPurchase{}, zero, fmt.Errorf("begin team purchase create: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var order OrderSummary
	var now time.Time
	err = tx.QueryRow(ctx,
		`SELECT id, buyer_id, status, now() FROM orders WHERE id = $1 FOR UPDATE`,
		in.OrderID,
	).Scan(&order.ID, &order.BuyerID, &order.Status, &now)

	if errors.Is(err, pgx.ErrNoRows) {
		return TeamPurchase{}, zero, ErrNotFound
	}
	if err != nil {
		return TeamPurchase{}, zero, fmt.Errorf("lock order: %w", err)
	}

	// Only the buyer can invite people onto their own order.
	if order.BuyerID != in.InviterID {
		return TeamPurchase{}, now, &EligibilityError{
			Code:    "not_order_buyer",
			Message: "Only the buyer who placed this order can start a team purchase on it.",
		}
	}

	// A discount has to be applied before the parcel is priced and shipped.
	if order.Status != orders.StatusPending {
		return TeamPurchase{}, now, &EligibilityError{
			Code:    "order_not_pending",
			Message: "This order is already " + order.Status + ", so it can no longer join a team purchase.",
		}
	}

	// One live team per order. An expired pending row does not block a retry,
	// which is what lets a buyer share again after nobody joined in time.
	var existingID, existingStatus string
	var existingCreatedAt time.Time
	err = tx.QueryRow(ctx,
		`SELECT id, status, created_at
		   FROM team_purchases
		  WHERE order_id = $1
		    AND status <> 'expired'
		  ORDER BY created_at DESC
		  LIMIT 1`,
		in.OrderID,
	).Scan(&existingID, &existingStatus, &existingCreatedAt)

	switch {
	case err == nil:
		existing := TeamPurchase{Status: existingStatus, CreatedAt: existingCreatedAt}
		if !isExpired(existing, now, s.window) {
			return TeamPurchase{}, now, &EligibilityError{
				Code:    "team_purchase_exists",
				Message: "This order already has a team purchase (" + existingID + ") that is " + existingStatus + ".",
			}
		}
		// Stale pending row: close it out so the unique-ish invariant holds.
		if _, err := tx.Exec(ctx,
			`UPDATE team_purchases SET status = 'expired' WHERE id = $1`, existingID,
		); err != nil {
			return TeamPurchase{}, now, fmt.Errorf("expire stale team purchase: %w", err)
		}
	case errors.Is(err, pgx.ErrNoRows):
		// No team on this order yet, which is the common case.
	default:
		return TeamPurchase{}, now, fmt.Errorf("check existing team purchase: %w", err)
	}

	tp, err := scanTeamPurchase(tx.QueryRow(ctx,
		`INSERT INTO team_purchases (order_id, inviter_id, status, discount_applied_pct)
		 VALUES ($1, $2, 'pending_join', $3::numeric)
		 RETURNING `+teamPurchaseColumns,
		in.OrderID, in.InviterID, in.DiscountPct,
	))
	if err != nil {
		return TeamPurchase{}, now, err
	}

	if err := tx.Commit(ctx); err != nil {
		return TeamPurchase{}, now, fmt.Errorf("commit team purchase create: %w", err)
	}

	decorate(&tp, now, s.window)
	return tp, now, nil
}

// EligibilityError is a refusal the caller could have predicted: the wrong
// person, the wrong moment, or a team that is already spoken for.
type EligibilityError struct {
	Code    string
	Message string
}

func (e *EligibilityError) Error() string { return e.Message }

// ExpiredError means the join window closed before anybody joined.
type ExpiredError struct {
	ExpiredAt time.Time
}

func (e *ExpiredError) Error() string {
	return "team purchase expired at " + e.ExpiredAt.Format(time.RFC3339)
}

// JoinResult is what a successful join produced.
type JoinResult struct {
	TeamPurchase TeamPurchase
	Order        orders.Order
	// PreviousTotalPKR is the order total before the discount came off, so the
	// app can show the strike-through price.
	PreviousTotalPKR string
}

// Join accepts an invitee into a pending team purchase and applies the
// discount to the order.
//
// Everything happens in one transaction with the team purchase row locked:
// two friends tapping the same link at the same moment must not both win, and
// the discount must not come off the order twice.
func (s *Store) Join(ctx context.Context, teamPurchaseID, inviteeID string) (JoinResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return JoinResult{}, fmt.Errorf("begin team purchase join: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var tp TeamPurchase
	var now time.Time
	err = tx.QueryRow(ctx,
		`SELECT `+teamPurchaseColumns+`, now()
		   FROM team_purchases
		  WHERE id = $1
		  FOR UPDATE`,
		teamPurchaseID,
	).Scan(
		&tp.ID, &tp.OrderID, &tp.InviterID, &tp.InviteeID, &tp.Status,
		&tp.DiscountPct, &tp.CreatedAt, &tp.UpdatedAt, &now,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return JoinResult{}, ErrNotFound
	}
	if err != nil {
		return JoinResult{}, fmt.Errorf("lock team purchase: %w", err)
	}

	if tp.Status == StatusCompleted {
		return JoinResult{}, &EligibilityError{
			Code:    "team_purchase_completed",
			Message: "Somebody has already joined this team purchase.",
		}
	}

	if tp.Status == StatusExpired || isExpired(tp, now, s.window) {
		// Record the expiry so the next reader does not have to derive it.
		if tp.Status == StatusPendingJoin {
			if _, err := tx.Exec(ctx,
				`UPDATE team_purchases SET status = 'expired' WHERE id = $1`, tp.ID,
			); err != nil {
				return JoinResult{}, fmt.Errorf("expire team purchase: %w", err)
			}
			if err := tx.Commit(ctx); err != nil {
				return JoinResult{}, fmt.Errorf("commit team purchase expiry: %w", err)
			}
		}
		return JoinResult{}, &ExpiredError{ExpiredAt: expiresAt(tp.CreatedAt, s.window)}
	}

	// The database enforces this too; catching it here gives a real message.
	if tp.InviterID == inviteeID {
		return JoinResult{}, &EligibilityError{
			Code:    "self_join",
			Message: "You cannot join your own team purchase. Share the link with a friend.",
		}
	}

	var inviteeVerified bool
	err = tx.QueryRow(ctx,
		`SELECT is_verified FROM users WHERE id = $1`, inviteeID,
	).Scan(&inviteeVerified)

	if errors.Is(err, pgx.ErrNoRows) {
		return JoinResult{}, &EligibilityError{
			Code:    "invitee_not_found",
			Message: "No user with id " + inviteeID + ".",
		}
	}
	if err != nil {
		return JoinResult{}, fmt.Errorf("load invitee: %w", err)
	}
	if !inviteeVerified {
		return JoinResult{}, &EligibilityError{
			Code:    "invitee_not_verified",
			Message: "The joining user's phone number is not verified yet.",
		}
	}

	// Lock the order too, and capture the pre-discount total for the receipt.
	var previousTotal, orderStatus string
	err = tx.QueryRow(ctx,
		`SELECT total_amount_pkr::text, status FROM orders WHERE id = $1 FOR UPDATE`,
		tp.OrderID,
	).Scan(&previousTotal, &orderStatus)
	if err != nil {
		return JoinResult{}, fmt.Errorf("lock order: %w", err)
	}

	if orderStatus != orders.StatusPending {
		return JoinResult{}, &EligibilityError{
			Code:    "order_not_pending",
			Message: "This order is already " + orderStatus + ", so the discount can no longer be applied.",
		}
	}

	if _, err := tx.Exec(ctx,
		`UPDATE team_purchases
		    SET status = 'completed', invitee_id = $2
		  WHERE id = $1`,
		tp.ID, inviteeID,
	); err != nil {
		return JoinResult{}, fmt.Errorf("complete team purchase: %w", err)
	}

	// The arithmetic happens in Postgres on NUMERIC, never in Go on a float,
	// and commission_fee_pkr recomputes itself from the new total because it is
	// a generated column.
	order, err := orders.ScanOrder(tx.QueryRow(ctx,
		`UPDATE orders
		    SET total_amount_pkr = round(total_amount_pkr * (1 - ($2::numeric / 100)), 2)
		  WHERE id = $1
		  RETURNING `+orders.Columns,
		tp.OrderID, tp.DiscountPct,
	))
	if err != nil {
		return JoinResult{}, fmt.Errorf("apply team discount: %w", err)
	}

	updated, err := scanTeamPurchase(tx.QueryRow(ctx,
		`SELECT `+teamPurchaseColumns+` FROM team_purchases WHERE id = $1`, tp.ID,
	))
	if err != nil {
		return JoinResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return JoinResult{}, fmt.Errorf("commit team purchase join: %w", err)
	}

	decorate(&updated, now, s.window)
	return JoinResult{
		TeamPurchase:     updated,
		Order:            order,
		PreviousTotalPKR: previousTotal,
	}, nil
}
