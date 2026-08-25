package httpapi

import (
	"net/http/httptest"
	"testing"
)

func TestParseDiscoverySearchIntentStreetFoodIsNarrow(t *testing.T) {
	request := httptest.NewRequest("GET", "/api/v1/discovery/search?chips=Street+food", nil)
	intent := parseDiscoverySearchIntent(request, "")

	if !hasDiscoveryValue(intent.Categories, "Street food") {
		t.Fatalf("expected Street food category, got %#v", intent.Categories)
	}
	if hasDiscoveryValue(intent.Categories, "Restaurant or cafe") {
		t.Fatalf("street food chip should not broaden to Restaurant or cafe: %#v", intent.Categories)
	}
}

func TestParseDiscoverySearchIntentStreetFoodQueryIsNarrow(t *testing.T) {
	request := httptest.NewRequest("GET", "/api/v1/discovery/search?q=street+food", nil)
	intent := parseDiscoverySearchIntent(request, "street food")

	if !hasDiscoveryValue(intent.Categories, "Street food") {
		t.Fatalf("expected Street food category, got %#v", intent.Categories)
	}
	if hasDiscoveryValue(intent.Categories, "Restaurant or cafe") {
		t.Fatalf("street food query should not broaden to Restaurant or cafe: %#v", intent.Categories)
	}
}

func TestParseDiscoverySearchIntentFoodIsBroad(t *testing.T) {
	request := httptest.NewRequest("GET", "/api/v1/discovery/search?chips=Food", nil)
	intent := parseDiscoverySearchIntent(request, "")

	if !hasDiscoveryValue(intent.Categories, "Street food") {
		t.Fatalf("expected Food chip to include Street food, got %#v", intent.Categories)
	}
	if !hasDiscoveryValue(intent.Categories, "Restaurant or cafe") {
		t.Fatalf("expected Food chip to include Restaurant or cafe, got %#v", intent.Categories)
	}
}

func hasDiscoveryValue(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}
