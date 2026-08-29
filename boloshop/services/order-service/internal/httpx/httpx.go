// Package httpx holds the small HTTP helpers every handler in this service
// shares: one JSON error shape, one JSON writer, one body decoder.
//
// The error shape deliberately matches the Node services (api-gateway,
// media-service) so the Flutter client has a single error branch for the whole
// backend, whatever language served the response.
package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
)

// FieldError names one thing wrong with a request body.
type FieldError struct {
	Path    string `json:"path"`
	Message string `json:"message"`
}

// ErrorBody is the JSON envelope for every failure this service returns.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail carries the machine-readable code and the human-readable text.
type ErrorDetail struct {
	Code    string       `json:"code"`
	Message string       `json:"message"`
	Details []FieldError `json:"details,omitempty"`
}

// Error is an HTTP-aware error. Handlers return one; Handle turns it into a
// response. Anything else that comes back is a bug and becomes a 500.
type Error struct {
	Status  int
	Code    string
	Message string
	Details []FieldError
	// Err is the underlying cause. It is logged, never sent to the client.
	Err error
}

func (e *Error) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *Error) Unwrap() error { return e.Err }

// BadRequest is a 400 with optional field-level detail.
func BadRequest(message string, details ...FieldError) *Error {
	return &Error{Status: http.StatusBadRequest, Code: "bad_request", Message: message, Details: details}
}

// Forbidden is a 403.
func Forbidden(message string) *Error {
	return &Error{Status: http.StatusForbidden, Code: "forbidden", Message: message}
}

// NotFound is a 404.
func NotFound(message string) *Error {
	return &Error{Status: http.StatusNotFound, Code: "not_found", Message: message}
}

// Conflict is a 409: the request is well-formed but the resource is in a state
// that will not accept it.
func Conflict(code, message string) *Error {
	return &Error{Status: http.StatusConflict, Code: code, Message: message}
}

// Gone is a 410, used for a team purchase whose window has closed.
func Gone(code, message string) *Error {
	return &Error{Status: http.StatusGone, Code: code, Message: message}
}

// Unprocessable is a 422: syntactically valid, semantically refused.
func Unprocessable(code, message string) *Error {
	return &Error{Status: http.StatusUnprocessableEntity, Code: code, Message: message}
}

// Internal wraps an unexpected failure. The cause is logged, not returned.
func Internal(err error) *Error {
	return &Error{
		Status:  http.StatusInternalServerError,
		Code:    "internal_error",
		Message: "Something went wrong. Please try again.",
		Err:     err,
	}
}

// HandlerFunc is a handler that may fail. Returning an error is the only way
// to produce a failure response, so no handler can half-write one.
type HandlerFunc func(http.ResponseWriter, *http.Request) error

// Handle adapts a HandlerFunc to net/http, rendering whatever it returns.
func Handle(logger *slog.Logger, next HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := next(w, r)
		if err == nil {
			return
		}

		var httpErr *Error
		if !errors.As(err, &httpErr) {
			httpErr = Internal(err)
		}

		if httpErr.Status >= http.StatusInternalServerError {
			logger.Error("request failed",
				"method", r.Method,
				"path", r.URL.Path,
				"status", httpErr.Status,
				"error", err)
		}

		WriteJSON(logger, w, httpErr.Status, ErrorBody{Error: ErrorDetail{
			Code:    httpErr.Code,
			Message: httpErr.Message,
			Details: httpErr.Details,
		}})
	}
}

// WriteJSON writes v as JSON with the given status.
func WriteJSON(logger *slog.Logger, w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		// Encoding our own response failed: nothing useful left to say.
		logger.Error("failed to encode response", "error", err)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":{"code":"internal_error","message":"Response encoding failed."}}`))
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// maxBodyBytes caps request bodies. Order payloads are a few hundred bytes.
const maxBodyBytes = 64 << 10

// DecodeJSON reads exactly one JSON object into dst, rejecting unknown fields
// so a typo'd key is an error rather than a silently ignored value.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" {
		if mediaType := strings.TrimSpace(strings.Split(ct, ";")[0]); mediaType != "application/json" {
			return &Error{
				Status:  http.StatusUnsupportedMediaType,
				Code:    "unsupported_media_type",
				Message: fmt.Sprintf("Expected Content-Type application/json, got %q.", mediaType),
			}
		}
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return &Error{
				Status:  http.StatusRequestEntityTooLarge,
				Code:    "payload_too_large",
				Message: "Request body is too large.",
			}
		}
		if errors.Is(err, io.EOF) {
			return BadRequest("Request body is empty.")
		}
		return BadRequest(fmt.Sprintf("Request body is not valid JSON: %v.", err))
	}

	// A second value means the caller sent more than one object.
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return BadRequest("Request body must contain exactly one JSON object.")
	}

	return nil
}
