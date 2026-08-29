package teambuy

import (
	"testing"
	"time"
)

func TestParseDiscountDefaults(t *testing.T) {
	got, err := parseDiscount(nil)
	if err != nil {
		t.Fatalf("parseDiscount(nil) errored: %v", err.Message)
	}
	if got != "25.00" {
		t.Errorf("parseDiscount(nil) = %q, want 25.00", got)
	}

	if got, err := parseDiscount(""); err != nil || got != "25.00" {
		t.Errorf("parseDiscount(\"\") = %q, %v; want 25.00, nil", got, err)
	}
}

func TestParseDiscountAcceptsNumberAndString(t *testing.T) {
	// encoding/json decodes every JSON number into a float64.
	if got, err := parseDiscount(float64(20)); err != nil || got != "20.00" {
		t.Errorf("parseDiscount(20) = %q, %v", got, err)
	}
	if got, err := parseDiscount("30"); err != nil || got != "30.00" {
		t.Errorf("parseDiscount(\"30\") = %q, %v", got, err)
	}
	if got, err := parseDiscount(22.5); err != nil || got != "22.50" {
		t.Errorf("parseDiscount(22.5) = %q, %v", got, err)
	}
}

func TestParseDiscountRejectsOutOfBand(t *testing.T) {
	// The 20–30% band is the whole product decision; anything outside it is a
	// bug in the caller, not a discount.
	for _, bad := range []any{float64(19.99), float64(30.01), float64(0), float64(100), float64(-5)} {
		if _, err := parseDiscount(bad); err == nil {
			t.Errorf("parseDiscount(%v) accepted an out-of-band discount", bad)
		}
	}
	for _, bad := range []any{"abc", true, []any{25}} {
		if _, err := parseDiscount(bad); err == nil {
			t.Errorf("parseDiscount(%v) accepted a non-numeric discount", bad)
		}
	}
}

func TestToPaisa(t *testing.T) {
	cases := map[string]int64{
		"0":        0,
		"1":        100,
		"4499.50":  449950,
		"4499.5":   449950,
		"4499.05":  449905,
		"4499":     449900,
		" 4499.50": 449950,
	}
	for input, want := range cases {
		got, ok := toPaisa(input)
		if !ok || got != want {
			t.Errorf("toPaisa(%q) = %d, %v; want %d, true", input, got, ok, want)
		}
	}

	for _, bad := range []string{"", "abc", "4,499"} {
		if _, ok := toPaisa(bad); ok {
			t.Errorf("toPaisa(%q) reported success", bad)
		}
	}
}

func TestSubtractPKRIsExact(t *testing.T) {
	// 4499.50 * 0.75 = 3374.63 (rounded), so the saving is 1124.87. Done in
	// float64 this is the kind of sum that lands on 1124.8699999999999.
	if got := subtractPKR("4499.50", "3374.63"); got != "1124.87" {
		t.Errorf("subtractPKR = %q, want 1124.87", got)
	}
	if got := subtractPKR("100.00", "80.00"); got != "20.00" {
		t.Errorf("subtractPKR = %q, want 20.00", got)
	}
	if got := subtractPKR("0.10", "0.03"); got != "0.07" {
		t.Errorf("subtractPKR = %q, want 0.07", got)
	}
	// A total that went up is not a negative saving.
	if got := subtractPKR("50.00", "80.00"); got != "0.00" {
		t.Errorf("subtractPKR(negative) = %q, want 0.00", got)
	}
}

func TestIsExpired(t *testing.T) {
	window := 24 * time.Hour
	created := time.Date(2026, 8, 29, 12, 0, 0, 0, time.UTC)
	pending := TeamPurchase{Status: StatusPendingJoin, CreatedAt: created}

	if isExpired(pending, created.Add(23*time.Hour), window) {
		t.Error("a team purchase inside its window should not be expired")
	}
	if !isExpired(pending, created.Add(24*time.Hour), window) {
		t.Error("a team purchase at exactly the window edge should be expired")
	}
	if !isExpired(pending, created.Add(25*time.Hour), window) {
		t.Error("a team purchase past its window should be expired")
	}

	// A completed team purchase is done, not expired, however long ago it ran.
	completed := TeamPurchase{Status: StatusCompleted, CreatedAt: created}
	if isExpired(completed, created.Add(100*time.Hour), window) {
		t.Error("a completed team purchase should never report expired")
	}
}

func TestDecorateCountdown(t *testing.T) {
	window := 24 * time.Hour
	created := time.Date(2026, 8, 29, 12, 0, 0, 0, time.UTC)

	tp := TeamPurchase{Status: StatusPendingJoin, CreatedAt: created}
	decorate(&tp, created.Add(time.Hour), window)

	if !tp.ExpiresAt.Equal(created.Add(window)) {
		t.Errorf("ExpiresAt = %v, want %v", tp.ExpiresAt, created.Add(window))
	}
	if tp.SecondsRemaining != 23*3600 {
		t.Errorf("SecondsRemaining = %d, want %d", tp.SecondsRemaining, 23*3600)
	}

	// Past the window, and for anything already resolved, the countdown is 0
	// rather than a negative number the app would have to special-case.
	past := TeamPurchase{Status: StatusPendingJoin, CreatedAt: created}
	decorate(&past, created.Add(30*time.Hour), window)
	if past.SecondsRemaining != 0 {
		t.Errorf("expired SecondsRemaining = %d, want 0", past.SecondsRemaining)
	}

	done := TeamPurchase{Status: StatusCompleted, CreatedAt: created}
	decorate(&done, created.Add(time.Hour), window)
	if done.SecondsRemaining != 0 {
		t.Errorf("completed SecondsRemaining = %d, want 0", done.SecondsRemaining)
	}
}
