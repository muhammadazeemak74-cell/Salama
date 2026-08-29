// Package orders owns the order lifecycle: creation with the platform
// commission, retrieval with shipment status, and courier tracking updates.
package orders

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"boloshop/order-service/internal/validate"
)

// Status values mirror the order_status enum in the database.
const (
	StatusPending     = "pending"
	StatusShipped     = "shipped"
	StatusDelivered   = "delivered"
	StatusRTOReturned = "rto_returned"
)

// allowedTransitions is the shipment state machine. A parcel goes out, then it
// either arrives or comes back; delivered and rto_returned are terminal, so a
// courier webhook replaying an old event cannot walk an order backwards.
var allowedTransitions = map[string][]string{
	StatusPending:     {StatusShipped},
	StatusShipped:     {StatusDelivered, StatusRTOReturned},
	StatusDelivered:   {},
	StatusRTOReturned: {},
}

// TransitionAllowed reports whether from -> to is a legal shipment move.
func TransitionAllowed(from, to string) bool {
	for _, candidate := range allowedTransitions[from] {
		if candidate == to {
			return true
		}
	}
	return false
}

// NextStatuses lists what an order in the given status may become. Used to
// make the rejection message actionable rather than just "no".
func NextStatuses(from string) []string {
	next := allowedTransitions[from]
	if len(next) == 0 {
		return nil
	}
	return next
}

// Order is a row of the orders table as this service returns it.
//
// The money fields are strings: they are NUMERIC(12,2) in Postgres, and a
// float64 cannot hold every PKR value exactly. They are cast to text in SQL
// and passed through untouched.
type Order struct {
	ID                string    `json:"id"`
	BuyerID           string    `json:"buyer_id"`
	SellerID          string    `json:"seller_id"`
	TotalAmountPKR    string    `json:"total_amount_pkr"`
	CommissionFeePKR  string    `json:"commission_fee_pkr"`
	Status            string    `json:"status"`
	PaymentMethod     string    `json:"payment_method"`
	CourierTrackingID *string   `json:"courier_tracking_id"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// Tracking is the shipment view of an order.
type Tracking struct {
	Status            string    `json:"status"`
	CourierTrackingID *string   `json:"courier_tracking_id"`
	UpdatedAt         time.Time `json:"updated_at"`
	NextStatuses      []string  `json:"next_statuses"`
	IsTerminal        bool      `json:"is_terminal"`
}

// TrackingOf projects an order into its shipment status.
func TrackingOf(order Order) Tracking {
	next := NextStatuses(order.Status)
	return Tracking{
		Status:            order.Status,
		CourierTrackingID: order.CourierTrackingID,
		UpdatedAt:         order.UpdatedAt,
		NextStatuses:      next,
		IsTerminal:        len(next) == 0,
	}
}

// Party is whoever is on one end of the order.
type Party struct {
	ID          string
	PhoneNumber string
	IsVerified  bool
	// StoreName is set for sellers only.
	StoreName string
}

// WhatsAppLink builds a wa.me deep link that opens a chat with the seller,
// prefilled with an order confirmation message.
//
// wa.me wants the number as bare digits with no plus and no separators, so the
// caller must pass a canonical E.164 string — which is what the database
// stores and what the handler checks before calling this.
func WhatsAppLink(template string, sellerPhone string, order Order, storeName string) string {
	digits := strings.TrimPrefix(sellerPhone, "+")

	replacer := strings.NewReplacer(
		"{{store}}", storeName,
		"{{order_id}}", order.ID,
		// The first UUID group is short enough to read aloud on a phone call
		// and still unambiguous in a single seller's order list.
		"{{order_short_id}}", ShortID(order.ID),
		"{{amount}}", validate.FormatPKR(order.TotalAmountPKR),
		"{{commission}}", validate.FormatPKR(order.CommissionFeePKR),
		"{{status}}", order.Status,
	)

	message := replacer.Replace(template)
	return fmt.Sprintf("https://wa.me/%s?text=%s", digits, url.QueryEscape(message))
}

// ShortID is the first group of a UUID, uppercased — the human-facing order
// reference.
func ShortID(id string) string {
	if first, _, found := strings.Cut(id, "-"); found {
		return strings.ToUpper(first)
	}
	return strings.ToUpper(id)
}
