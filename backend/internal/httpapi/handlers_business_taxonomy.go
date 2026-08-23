package httpapi

import (
	"database/sql"
	"net/http"
)

type businessTaxonomyResponse struct {
	Categories []businessTaxonomyCategory `json:"categories"`
	Tags       []businessTaxonomyTag      `json:"tags"`
}

type businessTaxonomyCategory struct {
	ID            int64                         `json:"id"`
	Slug          string                        `json:"slug"`
	Name          string                        `json:"name"`
	Description   *string                       `json:"description,omitempty"`
	Subcategories []businessTaxonomySubcategory `json:"subcategories"`
}

type businessTaxonomySubcategory struct {
	ID   int64  `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
}

type businessTaxonomyTag struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
	Slug string `json:"slug"`
	Name string `json:"name"`
}

func (s *Server) handleBusinessTaxonomy(w http.ResponseWriter, r *http.Request) {
	categories, err := s.getBusinessTaxonomyCategories(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business taxonomy")
		return
	}

	tags, err := s.getBusinessTaxonomyTags(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business taxonomy")
		return
	}

	writeJSON(w, http.StatusOK, businessTaxonomyResponse{
		Categories: categories,
		Tags:       tags,
	})
}

func (s *Server) getBusinessTaxonomyCategories(r *http.Request) ([]businessTaxonomyCategory, error) {
	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT c.id, c.slug, c.name, c.description, s.id, s.slug, s.name
		 FROM business_categories c
		 LEFT JOIN business_subcategories s
		   ON s.category_id = c.id AND s.active = true
		 WHERE c.active = true
		 ORDER BY c.display_order, c.name, s.display_order, s.name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]businessTaxonomyCategory, 0)
	categoryIndexes := make(map[int64]int)
	for rows.Next() {
		var category businessTaxonomyCategory
		var description sql.NullString
		var subcategoryID sql.NullInt64
		var subcategorySlug, subcategoryName sql.NullString
		if err := rows.Scan(
			&category.ID,
			&category.Slug,
			&category.Name,
			&description,
			&subcategoryID,
			&subcategorySlug,
			&subcategoryName,
		); err != nil {
			return nil, err
		}

		index, exists := categoryIndexes[category.ID]
		if !exists {
			category.Description = nullableString(description)
			category.Subcategories = []businessTaxonomySubcategory{}
			categories = append(categories, category)
			index = len(categories) - 1
			categoryIndexes[category.ID] = index
		}

		if subcategoryID.Valid && subcategorySlug.Valid && subcategoryName.Valid {
			categories[index].Subcategories = append(categories[index].Subcategories, businessTaxonomySubcategory{
				ID:   subcategoryID.Int64,
				Slug: subcategorySlug.String,
				Name: subcategoryName.String,
			})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return categories, nil
}

func (s *Server) getBusinessTaxonomyTags(r *http.Request) ([]businessTaxonomyTag, error) {
	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT id, tag_type, slug, name
		 FROM business_discovery_tags
		 WHERE active = true
		 ORDER BY tag_type, display_order, name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := make([]businessTaxonomyTag, 0)
	for rows.Next() {
		var tag businessTaxonomyTag
		if err := rows.Scan(&tag.ID, &tag.Type, &tag.Slug, &tag.Name); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return tags, nil
}
