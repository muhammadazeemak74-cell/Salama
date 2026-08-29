package validate

import "testing"

func TestIsE164(t *testing.T) {
	valid := []string{"+923001234567", "+12025550143", "+441234567", "+923339876543"}
	for _, phone := range valid {
		if !IsE164(phone) {
			t.Errorf("IsE164(%q) = false, want true", phone)
		}
	}

	invalid := []string{
		"",
		"03001234567",          // local Pakistani format, no country code
		"+0923001234567",       // leading zero after +
		"+92 300 1234567",      // spaces
		"+92-300-1234567",      // separators
		"923001234567",         // no plus
		"+9230012345678901234", // too long
		"+123456",              // too short
		"+92300123456a",        // not all digits
	}
	for _, phone := range invalid {
		if IsE164(phone) {
			t.Errorf("IsE164(%q) = true, want false", phone)
		}
	}
}

func TestPKRAmount(t *testing.T) {
	valid := []string{"0", "4499", "4499.5", "4499.50", "1234567890.99"}
	for _, amount := range valid {
		if err := PKRAmount("total_amount_pkr", amount); err != nil {
			t.Errorf("PKRAmount(%q) = %v, want nil", amount, err.Message)
		}
	}

	invalid := []string{"", "-1", "4499.999", "4,499", "1e5", "abc", "12345678901"}
	for _, amount := range invalid {
		if err := PKRAmount("total_amount_pkr", amount); err == nil {
			t.Errorf("PKRAmount(%q) = nil, want an error", amount)
		}
	}
}

func TestUUID(t *testing.T) {
	if err := UUID("id", "3aff3bf4-f7ae-43ac-a1c0-0430a3c615ff"); err != nil {
		t.Errorf("UUID(valid) = %v, want nil", err.Message)
	}
	for _, bad := range []string{"", "nope", "3aff3bf4f7ae43aca1c00430a3c615ff"} {
		if err := UUID("id", bad); err == nil {
			t.Errorf("UUID(%q) = nil, want an error", bad)
		}
	}
}

func TestFormatPKR(t *testing.T) {
	cases := map[string]string{
		"0":          "Rs 0",
		"999":        "Rs 999",
		"1000":       "Rs 1,000",
		"4499.00":    "Rs 4,499",
		"4499.50":    "Rs 4,499.50",
		"4499.5":     "Rs 4,499.50",
		"1234567.05": "Rs 1,234,567.05",
		"44.99":      "Rs 44.99",
	}
	for input, want := range cases {
		if got := FormatPKR(input); got != want {
			t.Errorf("FormatPKR(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestCollectDropsNils(t *testing.T) {
	got := Collect(nil, UUID("id", "bad"), nil, PKRAmount("amount", "-1"))
	if len(got) != 2 {
		t.Fatalf("Collect returned %d errors, want 2: %+v", len(got), got)
	}
	if got[0].Path != "id" || got[1].Path != "amount" {
		t.Errorf("Collect lost field order: %+v", got)
	}
}
