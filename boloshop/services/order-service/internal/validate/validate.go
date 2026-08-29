// Package validate holds the field checks shared across handlers.
//
// These mirror the constraints in packages/db/migrations/001_initial_schema.sql
// on purpose: the database is the authority, and rejecting bad input here just
// turns a constraint violation into a useful error message.
package validate

import (
	"fmt"
	"regexp"
	"strings"

	"boloshop/order-service/internal/httpx"
)

// e164Pattern matches the same shape as the users_phone_number_e164 check
// constraint: a leading +, then 8 to 15 digits. Pakistani mobile numbers
// arrive as +923XXXXXXXXX.
var e164Pattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)

// uuidPattern is deliberately loose about version and variant nibbles: the
// database is the authority on whether a given id exists.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// pkrAmountPattern matches a non-negative decimal with at most two places,
// which is what NUMERIC(12,2) stores. Money moves through this service as a
// string from end to end so it never passes through a float.
var pkrAmountPattern = regexp.MustCompile(`^[0-9]{1,10}(\.[0-9]{1,2})?$`)

// IsE164 reports whether phone is a canonical E.164 number.
func IsE164(phone string) bool {
	return e164Pattern.MatchString(phone)
}

// UUID checks a UUID field, returning a FieldError describing what is wrong.
func UUID(field, value string) *httpx.FieldError {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return &httpx.FieldError{Path: field, Message: field + " is required."}
	}
	if !uuidPattern.MatchString(trimmed) {
		return &httpx.FieldError{Path: field, Message: field + " must be a UUID."}
	}
	return nil
}

// PKRAmount checks a money field.
func PKRAmount(field, value string) *httpx.FieldError {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return &httpx.FieldError{Path: field, Message: field + " is required."}
	}
	if !pkrAmountPattern.MatchString(trimmed) {
		return &httpx.FieldError{
			Path:    field,
			Message: field + " must be a non-negative amount with at most two decimal places.",
		}
	}
	return nil
}

// Collect drops the nil entries and returns the real problems.
func Collect(errs ...*httpx.FieldError) []httpx.FieldError {
	var out []httpx.FieldError
	for _, err := range errs {
		if err != nil {
			out = append(out, *err)
		}
	}
	return out
}

// FormatPKR renders an amount string for display: "4499.50" becomes
// "Rs 4,499.50" and "4499.00" becomes "Rs 4,499". It works on the string
// straight out of the database, so no amount is routed through a float on its
// way to a WhatsApp message.
func FormatPKR(amount string) string {
	whole, fraction, hasFraction := strings.Cut(strings.TrimSpace(amount), ".")

	var grouped strings.Builder
	for i, digit := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			grouped.WriteByte(',')
		}
		grouped.WriteRune(digit)
	}

	if hasFraction {
		padded := (fraction + "00")[:2]
		if padded != "00" {
			return fmt.Sprintf("Rs %s.%s", grouped.String(), padded)
		}
	}
	return "Rs " + grouped.String()
}
