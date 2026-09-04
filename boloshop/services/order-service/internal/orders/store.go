package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a row the caller named does not exist.
var ErrNotFound = errors.New("not found")

// Store is the orders package's database access.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore wraps a pool.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Columns is the projection every order query returns, in Scan order. It is
// exported so the teambuy package can return an order it updated inside its
// own transaction without duplicating the projection.
//
// NUMERIC is cast to text here rather than decoded into a float: PKR amounts
// have to survive the round trip exactly.
const Columns = `id,
	buyer_id,
	seller_id,
	total_amount_pkr::text,
	commission_fee_pkr::text,
	status,
	payment_method,
	courier_tracking_id,
	created_at,
	updated_at`

// RowScanner is anything pgx can Scan from: a Row from a pool or from a tx.
type RowScanner interface {
	Scan(dest ...any) error
}

// ScanOrder reads a row projected with Columns into an Order.
func ScanOrder(row RowScanner) (Order, error) {
	var order Order
	err := row.Scan(
		&order.ID,
		&order.BuyerID,
		&order.SellerID,
		&order.TotalAmountPKR,
		&order.CommissionFeePKR,
		&order.Status,
		&order.PaymentMethod,
		&order.CourierTrackingID,
		&order.CreatedAt,
		&order.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrNotFound
	}
	if err != nil {
		return Order{}, fmt.Errorf("scan order: %w", err)
	}
	return order, nil
}

// FindBuyer loads the buyer's identity and verification state.
func (s *Store) FindBuyer(ctx context.Context, buyerID string) (Party, error) {
	var party Party
	err := s.pool.QueryRow(ctx,
		`SELECT id, phone_number, is_verified FROM users WHERE id = $1`,
		buyerID,
	).Scan(&party.ID, &party.PhoneNumber, &party.IsVerified)

	if errors.Is(err, pgx.ErrNoRows) {
		return Party{}, ErrNotFound
	}
	if err != nil {
		return Party{}, fmt.Errorf("find buyer: %w", err)
	}
	return party, nil
}

// FindSeller loads the seller's store and the phone number of the user who
// owns it — the number the WhatsApp confirmation link opens a chat with.
func (s *Store) FindSeller(ctx context.Context, sellerID string) (Party, error) {
	var party Party
	err := s.pool.QueryRow(ctx,
		`SELECT s.id, s.store_name, u.phone_number, u.is_verified
		   FROM sellers s
		   JOIN users u ON u.id = s.user_id
		  WHERE s.id = $1`,
		sellerID,
	).Scan(&party.ID, &party.StoreName, &party.PhoneNumber, &party.IsVerified)

	if errors.Is(err, pgx.ErrNoRows) {
		return Party{}, ErrNotFound
	}
	if err != nil {
		return Party{}, fmt.Errorf("find seller: %w", err)
	}
	return party, nil
}

// Create inserts an order.
//
// commission_fee_pkr is NOT passed: it is a generated column, always
// round(total_amount_pkr * 0.01, 2), computed by Postgres. Writing it here
// would be rejected by the database, which is the point — the 1% platform
// commission cannot drift because some caller computed it differently.
func (s *Store) Create(ctx context.Context, buyerID, sellerID, totalAmountPKR string) (Order, error) {
	return ScanOrder(s.pool.QueryRow(ctx,
		`INSERT INTO orders (buyer_id, seller_id, total_amount_pkr, payment_method)
		 VALUES ($1, $2, $3::numeric, 'cod')
		 RETURNING `+Columns,
		buyerID, sellerID, totalAmountPKR,
	))
}

// Get loads one order.
func (s *Store) Get(ctx context.Context, orderID string) (Order, error) {
	return ScanOrder(s.pool.QueryRow(ctx,
		`SELECT `+Columns+` FROM orders WHERE id = $1`,
		orderID,
	))
}

// TransitionError reports a shipment update refused by the state machine.
type TransitionError struct {
	From string
	To   string
}

func (e *TransitionError) Error() string {
	return fmt.Sprintf("cannot move an order from %s to %s", e.From, e.To)
}

// UpdateTracking moves an order to nextStatus, optionally setting the courier
// tracking id.
//
// The read and the write share one transaction with SELECT ... FOR UPDATE, so
// two courier webhooks arriving at once cannot both read "pending" and both
// decide they may ship it.
func (s *Store) UpdateTracking(
	ctx context.Context,
	orderID string,
	nextStatus string,
	trackingID *string,
) (Order, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Order{}, fmt.Errorf("begin tracking update: %w", err)
	}
	defer func() {
		// No-op once the transaction has committed.
		_ = tx.Rollback(ctx)
	}()

	var currentStatus string
	err = tx.QueryRow(ctx,
		`SELECT status FROM orders WHERE id = $1 FOR UPDATE`,
		orderID,
	).Scan(&currentStatus)

	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrNotFound
	}
	if err != nil {
		return Order{}, fmt.Errorf("lock order: %w", err)
	}

	if !TransitionAllowed(currentStatus, nextStatus) {
		return Order{}, &TransitionError{From: currentStatus, To: nextStatus}
	}

	// COALESCE keeps the existing tracking id when the caller does not send a
	// new one, which matters for delivered and rto_returned: the database
	// requires a tracking id on every non-pending order.
	order, err := ScanOrder(tx.QueryRow(ctx,
		`UPDATE orders
		    SET status = $2::order_status,
		        courier_tracking_id = COALESCE($3, courier_tracking_id)
		  WHERE id = $1
		  RETURNING `+Columns,
		orderID, nextStatus, trackingID,
	))
	if err != nil {
		return Order{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Order{}, fmt.Errorf("commit tracking update: %w", err)
	}
	return order, nil
}
