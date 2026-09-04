package orders

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"boloshop/order-service/internal/config"
	"boloshop/order-service/internal/httpx"
	"boloshop/order-service/internal/validate"
)

// Handler serves the order endpoints.
type Handler struct {
	logger *slog.Logger
	store  *Store
	cfg    config.Config
}

// NewHandler wires a handler to the pool.
func NewHandler(logger *slog.Logger, pool *pgxpool.Pool, cfg config.Config) *Handler {
	return &Handler{logger: logger, store: NewStore(pool), cfg: cfg}
}

// Register mounts the order routes. Method and wildcard patterns are stdlib
// ServeMux features as of Go 1.22, so this service needs no router dependency.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /api/v1/orders", httpx.Handle(h.logger, h.create))
	mux.Handle("GET /api/v1/orders/{id}", httpx.Handle(h.logger, h.get))
	mux.Handle("POST /api/v1/orders/{id}/tracking", httpx.Handle(h.logger, h.updateTracking))
}

// createRequest is the POST /api/v1/orders payload.
//
// There is no commission field on purpose: the 1% is computed by the database,
// not accepted from the caller.
type createRequest struct {
	BuyerID        string `json:"buyer_id"`
	SellerID       string `json:"seller_id"`
	TotalAmountPKR string `json:"total_amount_pkr"`
}

type createResponse struct {
	Order Order `json:"order"`
	// CommissionRatePct is echoed so a client never has to hardcode it.
	CommissionRatePct string   `json:"commission_rate_pct"`
	Tracking          Tracking `json:"tracking"`
	Seller            struct {
		ID          string `json:"id"`
		StoreName   string `json:"store_name"`
		PhoneNumber string `json:"phone_number"`
	} `json:"seller"`
	WhatsAppConfirmationURL string `json:"whatsapp_confirmation_url"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var req createRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		return err
	}

	if details := validate.Collect(
		validate.UUID("buyer_id", req.BuyerID),
		validate.UUID("seller_id", req.SellerID),
		validate.PKRAmount("total_amount_pkr", req.TotalAmountPKR),
	); len(details) > 0 {
		return httpx.BadRequest("Request validation failed.", details...)
	}

	ctx := r.Context()

	buyer, err := h.store.FindBuyer(ctx, strings.TrimSpace(req.BuyerID))
	if errors.Is(err, ErrNotFound) {
		return httpx.NotFound("No user with id " + req.BuyerID + ".")
	}
	if err != nil {
		return err
	}

	// A cash-on-delivery order is a promise to hand over goods against cash at
	// a doorstep. The only thing standing behind that promise is a phone number
	// somebody proved they hold, so an unverified buyer cannot place one.
	if !buyer.IsVerified {
		return httpx.Forbidden("The buyer's phone number is not verified yet. Verify it before ordering.")
	}
	if !validate.IsE164(buyer.PhoneNumber) {
		return httpx.Unprocessable(
			"invalid_buyer_phone",
			"The buyer's phone number is not in E.164 format and cannot be used for a COD order.",
		)
	}

	seller, err := h.store.FindSeller(ctx, strings.TrimSpace(req.SellerID))
	if errors.Is(err, ErrNotFound) {
		return httpx.NotFound("No seller with id " + req.SellerID + ".")
	}
	if err != nil {
		return err
	}

	// The confirmation link opens a chat with this number, so it has to be
	// dialable before the order is worth creating.
	if !validate.IsE164(seller.PhoneNumber) {
		return httpx.Unprocessable(
			"invalid_seller_phone",
			"The seller's phone number is not in E.164 format, so no WhatsApp confirmation can be sent.",
		)
	}

	order, err := h.store.Create(ctx, buyer.ID, seller.ID, strings.TrimSpace(req.TotalAmountPKR))
	if err != nil {
		return err
	}

	resp := createResponse{
		Order:             order,
		CommissionRatePct: "1.00",
		Tracking:          TrackingOf(order),
		WhatsAppConfirmationURL: WhatsAppLink(
			h.cfg.WhatsAppTemplate, seller.PhoneNumber, order, seller.StoreName,
		),
	}
	resp.Seller.ID = seller.ID
	resp.Seller.StoreName = seller.StoreName
	resp.Seller.PhoneNumber = seller.PhoneNumber

	httpx.WriteJSON(h.logger, w, http.StatusCreated, resp)
	return nil
}

type getResponse struct {
	Order    Order    `json:"order"`
	Tracking Tracking `json:"tracking"`
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	orderID := r.PathValue("id")
	if fieldErr := validate.UUID("id", orderID); fieldErr != nil {
		return httpx.BadRequest("Request validation failed.", *fieldErr)
	}

	order, err := h.store.Get(r.Context(), orderID)
	if errors.Is(err, ErrNotFound) {
		return httpx.NotFound("No order with id " + orderID + ".")
	}
	if err != nil {
		return err
	}

	httpx.WriteJSON(h.logger, w, http.StatusOK, getResponse{
		Order:    order,
		Tracking: TrackingOf(order),
	})
	return nil
}

type trackingRequest struct {
	Status            string `json:"status"`
	CourierTrackingID string `json:"courier_tracking_id"`
}

func (h *Handler) updateTracking(w http.ResponseWriter, r *http.Request) error {
	orderID := r.PathValue("id")
	if fieldErr := validate.UUID("id", orderID); fieldErr != nil {
		return httpx.BadRequest("Request validation failed.", *fieldErr)
	}

	var req trackingRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		return err
	}

	nextStatus := strings.TrimSpace(req.Status)
	switch nextStatus {
	case StatusShipped, StatusDelivered, StatusRTOReturned:
		// Fine. pending is excluded: nothing transitions back to it.
	case "":
		return httpx.BadRequest("Request validation failed.", httpx.FieldError{
			Path:    "status",
			Message: "status is required.",
		})
	default:
		return httpx.BadRequest("Request validation failed.", httpx.FieldError{
			Path: "status",
			Message: "status must be one of shipped, delivered, rto_returned (got " +
				nextStatus + ").",
		})
	}

	trackingID := strings.TrimSpace(req.CourierTrackingID)

	// Handing a parcel to a courier without recording its consignment number
	// means nobody can find it again; the database enforces this too, but a
	// named field error is more use to a caller than a constraint violation.
	if nextStatus == StatusShipped && trackingID == "" {
		return httpx.BadRequest("Request validation failed.", httpx.FieldError{
			Path:    "courier_tracking_id",
			Message: "courier_tracking_id is required when moving an order to shipped.",
		})
	}

	var trackingArg *string
	if trackingID != "" {
		trackingArg = &trackingID
	}

	order, err := h.store.UpdateTracking(r.Context(), orderID, nextStatus, trackingArg)
	if errors.Is(err, ErrNotFound) {
		return httpx.NotFound("No order with id " + orderID + ".")
	}

	var transitionErr *TransitionError
	if errors.As(err, &transitionErr) {
		message := "This order is " + transitionErr.From + " and cannot become " + transitionErr.To + "."
		if next := NextStatuses(transitionErr.From); len(next) > 0 {
			message += " It can only move to " + strings.Join(next, " or ") + "."
		} else {
			message += " It has reached a final state."
		}
		return httpx.Conflict("invalid_status_transition", message)
	}

	if err != nil {
		return err
	}

	httpx.WriteJSON(h.logger, w, http.StatusOK, getResponse{
		Order:    order,
		Tracking: TrackingOf(order),
	})
	return nil
}
