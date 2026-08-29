package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type reverseLocationResponse struct {
	Location  string `json:"location"`
	Primary   string `json:"primary"`
	Secondary string `json:"secondary"`
}

type nominatimReverseResponse struct {
	DisplayName string            `json:"display_name"`
	Address     map[string]string `json:"address"`
}

func (s *Server) handleLocationReverse(w http.ResponseWriter, r *http.Request) {
	latitude := queryFloat(r, "latitude")
	longitude := queryFloat(r, "longitude")
	if latitude == nil || *latitude < -90 || *latitude > 90 {
		writeError(w, http.StatusBadRequest, "latitude must be between -90 and 90")
		return
	}
	if longitude == nil || *longitude < -180 || *longitude > 180 {
		writeError(w, http.StatusBadRequest, "longitude must be between -180 and 180")
		return
	}

	location, err := reverseLocation(r.Context(), *latitude, *longitude)
	if err != nil {
		s.logger.Warn("reverse geocode failed", "error", err)
		location = s.fallbackReverseLocation(r.Context(), *latitude, *longitude)
	}

	writeJSON(w, http.StatusOK, location)
}

func reverseLocation(ctx context.Context, latitude, longitude float64) (reverseLocationResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	query := url.Values{}
	query.Set("format", "jsonv2")
	query.Set("lat", fmt.Sprintf("%.7f", latitude))
	query.Set("lon", fmt.Sprintf("%.7f", longitude))
	query.Set("zoom", "16")
	query.Set("addressdetails", "1")

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://nominatim.openstreetmap.org/reverse?"+query.Encode(), nil)
	if err != nil {
		return reverseLocationResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "Zumers/1.0 location resolver")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return reverseLocationResponse{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return reverseLocationResponse{}, fmt.Errorf("reverse geocode status %d", response.StatusCode)
	}

	var payload nominatimReverseResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil {
		return reverseLocationResponse{}, err
	}

	location := buildReverseLocation(payload)
	if location.Location == "" {
		return reverseLocationResponse{}, fmt.Errorf("reverse geocode returned empty location")
	}
	return location, nil
}

func buildReverseLocation(payload nominatimReverseResponse) reverseLocationResponse {
	address := payload.Address
	primary := firstNonEmpty(
		address["neighbourhood"],
		address["suburb"],
		address["quarter"],
		address["city_district"],
		address["city"],
		address["town"],
		address["village"],
		address["county"],
	)
	if primary == "" && payload.DisplayName != "" {
		primary = strings.TrimSpace(strings.Split(payload.DisplayName, ",")[0])
	}

	secondaryParts := uniqueNonEmpty(
		address["suburb"],
		address["city_district"],
		address["city"],
		address["town"],
		address["state"],
		address["country"],
	)
	secondaryParts = removeString(secondaryParts, primary)
	secondary := strings.Join(secondaryParts, ", ")

	locationParts := uniqueNonEmpty(primary)
	locationParts = append(locationParts, secondaryParts...)
	location := strings.Join(locationParts, ", ")
	if location == "" {
		location = payload.DisplayName
	}

	return reverseLocationResponse{
		Location:  location,
		Primary:   primary,
		Secondary: secondary,
	}
}

func (s *Server) fallbackReverseLocation(ctx context.Context, latitude, longitude float64) reverseLocationResponse {
	if location, err := s.nearestKnownLocation(ctx, latitude, longitude); err == nil && location.Location != "" {
		return location
	}
	return reverseLocationResponse{
		Location: "Current location",
		Primary:  "Current location",
	}
}

func (s *Server) nearestKnownLocation(ctx context.Context, latitude, longitude float64) (reverseLocationResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	var label string
	err := s.db.QueryRowContext(
		ctx,
		`WITH places AS (
		   SELECT
		     concat_ws(', ', nullif(area, ''), nullif(city, ''), nullif(state, ''), nullif(country, '')) AS label,
		     latitude::float8 AS latitude,
		     longitude::float8 AS longitude
		   FROM business_accounts
		   WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND account_status = 'active'
		   UNION ALL
		   SELECT
		     concat_ws(', ', nullif(area, ''), nullif(city, ''), nullif(state, ''), nullif(country, '')) AS label,
		     latitude::float8 AS latitude,
		     longitude::float8 AS longitude
		   FROM business_venues
		   WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active'
		 )
		 SELECT label
		 FROM places
		 WHERE label <> ''
		 ORDER BY ((latitude - $1) * (latitude - $1)) + ((longitude - $2) * (longitude - $2))
		 LIMIT 1`,
		latitude,
		longitude,
	).Scan(&label)
	if err != nil {
		return reverseLocationResponse{}, err
	}
	return locationResponseFromLabel(label), nil
}

func locationResponseFromLabel(label string) reverseLocationResponse {
	parts := strings.Split(label, ",")
	cleaned := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	if len(cleaned) == 0 {
		return reverseLocationResponse{}
	}
	return reverseLocationResponse{
		Location:  strings.Join(cleaned, ", "),
		Primary:   cleaned[0],
		Secondary: strings.Join(cleaned[1:], ", "),
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func uniqueNonEmpty(values ...string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func removeString(values []string, blocked string) []string {
	blocked = strings.ToLower(strings.TrimSpace(blocked))
	if blocked == "" {
		return values
	}
	result := values[:0]
	for _, value := range values {
		if strings.ToLower(strings.TrimSpace(value)) != blocked {
			result = append(result, value)
		}
	}
	return result
}
