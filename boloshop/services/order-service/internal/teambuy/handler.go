package teambuy

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"boloshop/order-service/internal/config"
	"boloshop/order-service/internal/httpx"
	"boloshop/order-service/internal/orders"
	"boloshop/order-service/internal/validate"
)

// Handler serves the team purchase endpoints.
type Handler struct {
	logger *slog.Logger
	store  *Store
	cfg    config.Config
}

// NewHandler wires a handler to the pool.
func NewHandler(logger *slog.Logger, pool *pgxpool.Pool, cfg config.Config) *Handler {
	return &Handler{
		logger: logger,
		store:  NewStore(pool, cfg.TeamBuyWindow),
		cfg:    cfg,
	}
}

// Register mounts the team purchase routes.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /api/v1/team-buy/create", httpx.Handle(h.logger, h.create))
	mux.Handle("POST /api/v1/team-buy/join", httpx.Handle(h.logger, h.join))
}

type createRequest struct {
	OrderID   string `json:"order_id"`
	InviterID string `json:"inviter_id"`
	// DiscountPct is optional; it defaults to DefaultDiscountPct. Accepted as
	// a JSON number or string so a client that keeps money as text can too.
	DiscountPct any `json:"discount_pct"`
}

type createResponse struct {
	TeamPurchase TeamPurchase `json:"team_purchase"`
	ShareURL     string       `json:"share_url"`
	WindowHours  int          `json:"window_hours"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var req createRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		return err
	}

	details := validate.Collect(
		validate.UUID("order_id", req.OrderID),
		validate.UUID("inviter_id", req.InviterID),
	)

	discountPct, discountErr := parseDiscount(req.DiscountPct)
	if discountErr != nil {
		details = append(details, *discountErr)
	}

	if len(details) > 0 {
		return httpx.BadRequest("Request validation failed.", details...)
	}

	tp, _, err := h.store.Create(r.Context(), CreateInput{
		OrderID:     strings.TrimSpace(req.OrderID),
		InviterID:   strings.TrimSpace(req.InviterID),
		DiscountPct: discountPct,
	})

	if errors.Is(err, ErrNotFound) {
		return httpx.NotFound("No order with id " + req.OrderID + ".")
	}

	var eligibilityErr *EligibilityError
	if errors.As(err, &eligibilityErr) {
		return httpx.Conflict(eligibilityErr.Code, eligibilityErr.Message)
	}
	if err != nil {
		return err
	}

	httpx.WriteJSON(h.logger, w, http.StatusCreated, createResponse{
		TeamPurchase: tp,
		ShareURL:     h.cfg.TeamBuyBaseURL + "/" + tp.ID,
		WindowHours:  int(h.cfg.TeamBuyWindow.Hours()),
	})
	return nil
}

type joinRequest struct {
	TeamPurchaseID string `json:"team_purchase_id"`
	InviteeID      string `json:"invitee_id"`
}

type joinResponse struct {
	TeamPurchase TeamPurchase `json:"team_purchase"`
	Order        orders.Order `json:"order"`
	Discount     struct {
		Pct              string `json:"pct"`
		PreviousTotalPKR string `json:"previous_total_amount_pkr"`
		NewTotalPKR      string `json:"total_amount_pkr"`
		SavedPKR         string `json:"saved_pkr"`
		CommissionFeePKR string `json:"commission_fee_pkr"`
	} `json:"discount"`
}

func (h *Handler) join(w http.ResponseWriter, r *http.Request) error {
	var req joinRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		return err
	}

	if details := validate.Collect(
		validate.UUID("team_purchase_id", req.TeamPurchaseID),
		validate.UUID("invitee_id", req.InviteeID),
	); len(details) > 0 {
		return httpx.BadRequest("Request validation failed.", details...)
	}

	result, err := h.store.Join(
		r.Context(),
		strings.TrimSpace(req.TeamPurchaseID),
		strings.TrimSpace(req.InviteeID),
	)

	if errors.Is(err, ErrNotFound) {
		return httpx.NotFound("No team purchase with id " + req.TeamPurchaseID + ".")
	}

	var expiredErr *ExpiredError
	if errors.As(err, &expiredErr) {
		return httpx.Gone(
			"team_purchase_expired",
			"This team purchase closed at "+expiredErr.ExpiredAt.Format("2006-01-02 15:04 MST")+
				". Ask your friend to start a new one.",
		)
	}

	var eligibilityErr *EligibilityError
	if errors.As(err, &eligibilityErr) {
		if eligibilityErr.Code == "invitee_not_found" {
			return httpx.NotFound(eligibilityErr.Message)
		}
		return httpx.Conflict(eligibilityErr.Code, eligibilityErr.Message)
	}
	if err != nil {
		return err
	}

	resp := joinResponse{TeamPurchase: result.TeamPurchase, Order: result.Order}
	resp.Discount.Pct = result.TeamPurchase.DiscountPct
	resp.Discount.PreviousTotalPKR = result.PreviousTotalPKR
	resp.Discount.NewTotalPKR = result.Order.TotalAmountPKR
	resp.Discount.SavedPKR = subtractPKR(result.PreviousTotalPKR, result.Order.TotalAmountPKR)
	resp.Discount.CommissionFeePKR = result.Order.CommissionFeePKR

	httpx.WriteJSON(h.logger, w, http.StatusOK, resp)
	return nil
}

// parseDiscount accepts a number or a numeric string, defaults when absent,
// and holds the result to the 20–30% band.
func parseDiscount(raw any) (string, *httpx.FieldError) {
	invalid := &httpx.FieldError{
		Path: "discount_pct",
		Message: fmt.Sprintf("discount_pct must be a number between %d and %d.",
			MinDiscountPct, MaxDiscountPct),
	}

	var value float64
	switch typed := raw.(type) {
	case nil:
		return strconv.FormatFloat(DefaultDiscountPct, 'f', 2, 64), nil
	case float64:
		value = typed
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return strconv.FormatFloat(DefaultDiscountPct, 'f', 2, 64), nil
		}
		parsed, err := strconv.ParseFloat(trimmed, 64)
		if err != nil {
			return "", invalid
		}
		value = parsed
	default:
		return "", invalid
	}

	if value < MinDiscountPct || value > MaxDiscountPct {
		return "", invalid
	}

	// NUMERIC(5,2) in the database, so two places is all that survives anyway.
	return strconv.FormatFloat(value, 'f', 2, 64), nil
}

// subtractPKR computes previous - current in paisa, so the saving is exact.
// Both inputs come from Postgres NUMERIC(12,2) casts, so they always parse.
func subtractPKR(previous, current string) string {
	previousPaisa, okPrevious := toPaisa(previous)
	currentPaisa, okCurrent := toPaisa(current)
	if !okPrevious || !okCurrent {
		return "0.00"
	}

	saved := previousPaisa - currentPaisa
	if saved < 0 {
		saved = 0
	}
	return fmt.Sprintf("%d.%02d", saved/100, saved%100)
}

// toPaisa turns "4499.50" into 449950. Integer paisa keeps the arithmetic
// exact where a float64 would not.
func toPaisa(amount string) (int64, bool) {
	whole, fraction, hasFraction := strings.Cut(strings.TrimSpace(amount), ".")

	wholePaisa, err := strconv.ParseInt(whole, 10, 64)
	if err != nil {
		return 0, false
	}

	var fractionPaisa int64
	if hasFraction {
		padded := (fraction + "00")[:2]
		fractionPaisa, err = strconv.ParseInt(padded, 10, 64)
		if err != nil {
			return 0, false
		}
	}

	return wholePaisa*100 + fractionPaisa, true
}
