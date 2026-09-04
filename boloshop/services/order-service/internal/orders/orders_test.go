package orders

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestTransitionAllowed(t *testing.T) {
	legal := [][2]string{
		{StatusPending, StatusShipped},
		{StatusShipped, StatusDelivered},
		{StatusShipped, StatusRTOReturned},
	}
	for _, move := range legal {
		if !TransitionAllowed(move[0], move[1]) {
			t.Errorf("TransitionAllowed(%s, %s) = false, want true", move[0], move[1])
		}
	}

	illegal := [][2]string{
		{StatusPending, StatusDelivered},   // cannot arrive without shipping
		{StatusPending, StatusRTOReturned}, // cannot come back before going out
		{StatusShipped, StatusPending},     // no walking backwards
		{StatusDelivered, StatusShipped},   // terminal
		{StatusDelivered, StatusRTOReturned},
		{StatusRTOReturned, StatusDelivered}, // terminal
		{StatusPending, StatusPending},       // not a move
		{"nonsense", StatusShipped},
	}
	for _, move := range illegal {
		if TransitionAllowed(move[0], move[1]) {
			t.Errorf("TransitionAllowed(%s, %s) = true, want false", move[0], move[1])
		}
	}
}

func TestNextStatusesTerminal(t *testing.T) {
	if got := NextStatuses(StatusDelivered); got != nil {
		t.Errorf("NextStatuses(delivered) = %v, want nil", got)
	}
	if got := NextStatuses(StatusRTOReturned); got != nil {
		t.Errorf("NextStatuses(rto_returned) = %v, want nil", got)
	}
	if got := NextStatuses(StatusPending); len(got) != 1 || got[0] != StatusShipped {
		t.Errorf("NextStatuses(pending) = %v, want [shipped]", got)
	}
}

func TestTrackingOfMarksTerminal(t *testing.T) {
	tracking := TrackingOf(Order{Status: StatusDelivered, UpdatedAt: time.Now()})
	if !tracking.IsTerminal {
		t.Error("delivered order should be terminal")
	}
	if tracking := TrackingOf(Order{Status: StatusPending}); tracking.IsTerminal {
		t.Error("pending order should not be terminal")
	}
}

func TestShortID(t *testing.T) {
	if got := ShortID("3aff3bf4-f7ae-43ac-a1c0-0430a3c615ff"); got != "3AFF3BF4" {
		t.Errorf("ShortID = %q, want 3AFF3BF4", got)
	}
	if got := ShortID("nodashes"); got != "NODASHES" {
		t.Errorf("ShortID(no dashes) = %q, want NODASHES", got)
	}
}

func TestWhatsAppLink(t *testing.T) {
	order := Order{
		ID:               "3aff3bf4-f7ae-43ac-a1c0-0430a3c615ff",
		TotalAmountPKR:   "4499.50",
		CommissionFeePKR: "44.99",
		Status:           StatusPending,
	}

	link := WhatsAppLink(
		"Salam {{store}}, order {{order_short_id}} for {{amount}} ({{status}}).",
		"+923001234567",
		order,
		"Lahore Lawn House",
	)

	// wa.me wants bare digits: no plus, no separators.
	if !strings.HasPrefix(link, "https://wa.me/923001234567?text=") {
		t.Fatalf("link has the wrong prefix: %s", link)
	}

	parsed, err := url.Parse(link)
	if err != nil {
		t.Fatalf("link does not parse: %v", err)
	}

	text := parsed.Query().Get("text")
	want := "Salam Lahore Lawn House, order 3AFF3BF4 for Rs 4,499.50 (pending)."
	if text != want {
		t.Errorf("message = %q, want %q", text, want)
	}
}

func TestWhatsAppLinkEscapesMessageText(t *testing.T) {
	// A store name is user input and lands in a URL query parameter.
	link := WhatsAppLink(
		"Hi {{store}}",
		"+923001234567",
		Order{ID: "a-b", TotalAmountPKR: "1"},
		"Ali & Sons #1 / Lahore?x=1",
	)

	if strings.Contains(link, "&x=1") || strings.Contains(link, "#1") {
		t.Fatalf("store name was not escaped into the query: %s", link)
	}

	parsed, err := url.Parse(link)
	if err != nil {
		t.Fatalf("link does not parse: %v", err)
	}
	if got := parsed.Query().Get("text"); got != "Hi Ali & Sons #1 / Lahore?x=1" {
		t.Errorf("round-tripped text = %q", got)
	}
}
