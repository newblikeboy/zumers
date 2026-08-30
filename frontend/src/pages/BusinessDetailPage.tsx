import {
  ArrowLeft,
  Bookmark,
  CalendarCheck,
  Check,
  Images,
  Navigation,
  Phone,
  Share2,
  Sparkles,
  Star,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { api } from '../lib/api'
import type {
  BusinessAccount,
  BusinessEvent,
  BusinessOffer,
  BusinessOpeningHour,
  BusinessVenueExperience,
  DiscoverySearchResult,
} from '../lib/types'

const savedBusinessesKey = 'zumers.discoverySavedBusinesses'
const pendingBusinessShareKey = 'zumers.pendingBusinessShare'
const discoveryLocationCacheKey = 'zumers.discoveryLocation'
const discoveryLocationCacheMaxAgeMs = 6 * 60 * 60 * 1000

type BusinessDetailLocationState = {
  businessPreview?: DiscoverySearchResult
}

type BusinessDetailCachedLocation = {
  latitude: number
  longitude: number
  savedAt: number
}

export function BusinessDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const businessID = Number(id)
  const previewResult = (location.state as BusinessDetailLocationState | null)?.businessPreview
  const previewBusiness = useMemo(
    () => (
      previewResult?.business_id === businessID
        ? businessFromDiscoveryResult(previewResult)
        : null
    ),
    [businessID, previewResult],
  )
  const [business, setBusiness] = useState<BusinessAccount | null>(() => previewBusiness)
  const [offers, setOffers] = useState<BusinessOffer[]>([])
  const [events, setEvents] = useState<BusinessEvent[]>([])
  const [related, setRelated] = useState<DiscoverySearchResult[]>([])
  const [likesCount, setLikesCount] = useState(() => previewResult?.likes_received ?? 0)
  const [liked, setLiked] = useState(() => previewResult?.liked_by_me ?? false)
  const [saved, setSaved] = useState(() =>
    Number.isFinite(businessID) ? loadSavedBusinesses().includes(businessID) : false,
  )
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [loading, setLoading] = useState(() => !previewBusiness)
  const [likeBusy, setLikeBusy] = useState(false)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.add('business-detail-open')
    return () => {
      document.body.classList.remove('business-detail-open')
    }
  }, [])

  useEffect(() => {
    if (!Number.isFinite(businessID) || businessID <= 0) {
      setError('Business not found')
      setLoading(false)
      return
    }

    let cancelled = false
    if (previewBusiness) {
      setBusiness((current) => current ?? previewBusiness)
      setLikesCount(previewResult?.likes_received ?? 0)
      setLiked(previewResult?.liked_by_me ?? false)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    api
      .businessDetail(businessID)
      .then((response) => {
        if (cancelled) return
        setBusiness(response.business)
        setOffers(response.offers ?? [])
        setEvents(response.events ?? [])
        setLikesCount(response.likes_received ?? 0)
        setLiked(response.liked_by_me ?? false)
        setSaved(loadSavedBusinesses().includes(businessID))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load business')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [businessID, previewBusiness, previewResult?.liked_by_me, previewResult?.likes_received])

  useEffect(() => {
    if (!business) return
    let cancelled = false
    const searchText = [
      business.business_subcategory,
      business.business_category,
      business.area,
      business.city,
      'restaurants',
    ]
      .filter(Boolean)
      .join(' ')
    void api
      .discoverySearch({
        query: searchText || 'restaurant cafe dining food',
        chips: ['Restaurant or cafe'],
        latitude: business.latitude,
        longitude: business.longitude,
        radiusKm: hasBusinessCoordinates(business) ? 10 : undefined,
        limit: 12,
      })
      .then((response) => {
        if (!cancelled) {
          setRelated(response.results.filter((item) => item.business_id !== business.id).slice(0, 6))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [business])

  const media = useMemo(() => businessMediaGallery(business), [business])
  const heroTiles = useMemo(() => {
    if (!media.length) return [null]
    const tileCount = Math.max(4, Math.min(media.length, 5))
    return Array.from({ length: tileCount }, (_, index) => media[index % media.length])
  }, [media])
  const cover = media[0]
  const activeOffers = offers.filter((offer) => offer.status === 'active').slice(0, 3)
  const menuPhotos = media.filter((item) => item.media_type === 'image')
  const facilities = tagList(business?.facility_tags)
  const experiences = business?.primary_venue?.experiences ?? []
  const primaryOffer = activeOffers[0]
  const bill = sampleBillForOffer(primaryOffer, business)
  const mapURL = business ? googleMapsURL(business) : ''
  const rating = business ? businessRating(likesCount) : '4.3'
  const addressLine = business ? businessAddressLine(business, previewResult) : ''
  const todayLabel = business
    ? todayHours(business.opening_hours_schedule) ?? plainText(business.opening_hours) ?? 'Hours not added'
    : 'Hours not added'

  async function toggleLike() {
    if (!business || likeBusy) return
    const previousLiked = liked
    const previousCount = likesCount
    const nextLiked = !previousLiked
    setLikeBusy(true)
    setLiked(nextLiked)
    setLikesCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)))
    setActionStatus(null)
    try {
      const response = previousLiked
        ? await api.removeBusinessLike(business.id)
        : await api.likeBusiness(business.id)
      setLiked(response.liked)
      setLikesCount(response.likes_received)
    } catch (err) {
      setLiked(previousLiked)
      setLikesCount(previousCount)
      setActionStatus(err instanceof Error ? err.message : 'Could not update like')
    } finally {
      setLikeBusy(false)
    }
  }

  function toggleSave() {
    if (!business) return
    const next = toggleSavedBusiness(business.id)
    const isSaved = next.includes(business.id)
    setSaved(isSaved)
    setActionStatus(isSaved ? 'Saved' : 'Removed')
  }

  function shareBusiness() {
    if (!business) return
    try {
      sessionStorage.setItem(
        pendingBusinessShareKey,
        JSON.stringify({
          business_id: business.id,
          title: business.business_name,
          business_name: business.business_name,
          category: business.business_category,
          subcategory: business.business_subcategory,
          location: business.location,
          city: business.city,
          area: business.area,
          price_label: priceRangeLabel(business.price_range),
          image_url: cover?.secure_url,
          active_offer_title: primaryOffer?.title,
          next_event_title: events[0]?.title,
        }),
      )
      navigate('/chat?share=business')
    } catch {
      setActionStatus('Could not open share')
    }
  }

  if (loading) {
    return (
      <section className="business-detail-page">
        <div className="business-detail-loading">Loading business</div>
      </section>
    )
  }

  if (error || !business) {
    return (
      <section className="business-detail-page">
        <EmptyState
          title={error ?? 'Business not found'}
          description="Try another restaurant from Plan."
          actionLabel="Back to Plan"
          actionTo="/"
        />
      </section>
    )
  }

  return (
    <section className="business-detail-page">
      <div className="business-detail-topbar">
        <button className="business-detail-back" type="button" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <strong>{business.business_name}</strong>
        <div>
          <button className="icon-button quiet" type="button" aria-label={saved ? 'Saved' : 'Save'} onClick={toggleSave}>
            <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button className="icon-button quiet" type="button" aria-label="Share" onClick={shareBusiness}>
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <header className="business-detail-hero">
        <div className="business-detail-photo-grid">
          {heroTiles.map((item, index) => (
            <div
              className={`business-detail-photo-tile tile-${index + 1}`}
              key={`${index}-${item?.id ?? item?.cloudinary_public_id ?? 'fallback'}`}
            >
              {item ? (
                item.media_type === 'video' ? (
                  <video muted playsInline preload="metadata" src={item.secure_url} />
                ) : (
                  <img src={item.secure_url} alt={item.alt_text ?? business.business_name} />
                )
              ) : (
                <div className="business-detail-cover-fallback">
                  <Utensils size={42} />
                </div>
              )}
            </div>
          ))}
          <button className="business-gallery-button" type="button" onClick={() => setGalleryOpen(true)}>
            <Images size={17} />
            <span>View gallery</span>
          </button>
        </div>

        <div className="business-detail-titlebar">
          <div>
            <h1>{business.business_name}</h1>
            <p>{[business.business_subcategory ?? business.business_category, priceRangeLabel(business.price_range)].filter(Boolean).join(' - ')}</p>
            {addressLine ? <p>{addressLine}</p> : null}
            <p>
              <strong className={business.open_now ? 'business-open-status' : 'business-closed-status'}>
                {business.open_now ? 'Open now' : 'Closed'}
              </strong>
              {' - '}
              {todayLabel}
            </p>
          </div>
          <div className="business-rating-pill">
            <strong>{rating}</strong>
            <Star size={14} fill="currentColor" />
            <span>{compactCount(likesCount)} ratings</span>
          </div>
        </div>

        <div className="business-detail-quick-actions">
          <a href={mapURL} target="_blank" rel="noreferrer" aria-label="Open Google Map">
            <Navigation size={18} />
            <span>Map</span>
          </a>
          {business.contact_phone || business.whatsapp_number ? (
            <a href={`tel:${business.contact_phone ?? business.whatsapp_number}`} aria-label="Call business">
              <Phone size={18} />
              <span>Call</span>
            </a>
          ) : null}
          <button type="button" onClick={toggleLike} disabled={likeBusy}>
            <Star size={18} fill={liked ? 'currentColor' : 'none'} />
            <span>Been here?</span>
          </button>
        </div>

        <nav className="business-detail-tabs" aria-label="Business detail sections">
          <a href="#business-offers">Offers</a>
          <a href="#business-menu">Menu</a>
          <a href="#business-reviews">Reviews</a>
          <a href="#business-facilities">Facilities</a>
          <a href="#business-explore">Explore More</a>
        </nav>
      </header>

      <ErrorBanner message={actionStatus} />

      <div className="business-detail-layout">
        <main className="business-detail-main">
          <section className="business-detail-card" id="business-offers">
            <SectionHeading title="Offers for today" subtitle={business.open_now ? 'Available now' : 'Check timing before booking'} />
            {activeOffers.length ? (
              <div className="business-offer-list">
                {activeOffers.map((offer) => (
                  <article className="business-offer-card" key={offer.id}>
                    <div className="business-offer-value">
                      <strong>{offerLabel(offer)}</strong>
                    </div>
                    <div>
                      <h3>{offer.title}</h3>
                      {offer.description ? <p>{offer.description}</p> : null}
                      <span>{offer.ends_on ? `Valid till ${offer.ends_on}` : 'Book now'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="business-detail-muted">No active offers right now.</p>
            )}
          </section>

          <section className="business-detail-card business-bill-card">
            <SectionHeading title="Sample bill" />
            <div className="sample-bill">
              <div>
                <span>Estimated bill for 2 guests</span>
                <strong>{currency(bill.original)}</strong>
              </div>
              <div>
                <span>You pay</span>
                <strong>{currency(bill.final)}</strong>
              </div>
              <div>
                <span>Save up to</span>
                <strong>{currency(bill.saving)}</strong>
              </div>
              <button type="button">Calculate savings on any bill amount</button>
            </div>
          </section>

          <section className="business-detail-card" id="business-menu">
            <SectionHeading title="Menu" subtitle="Updated recently" />
            {menuPhotos.length ? (
              <div className="business-menu-media">
                {menuPhotos.slice(0, 8).map((item) => (
                  <figure key={item.id ?? item.cloudinary_public_id}>
                    <img src={item.secure_url} alt={item.alt_text ?? 'Business photo'} />
                    <figcaption>{photoPurposeLabel(item.purpose)}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="business-detail-muted">Business photos will appear here after upload.</p>
            )}
          </section>

          <section className="business-detail-card" id="business-reviews">
            <SectionHeading title="Reviews" subtitle="See all" />
            <div className="business-rating-strip">
              <span><strong>{rating}</strong><Star size={13} fill="currentColor" /> {compactCount(likesCount)} ratings</span>
              <span><strong>4.6</strong> Food</span>
              <span><strong>4.5</strong> Service</span>
              <span><strong>4.5</strong> Ambience</span>
            </div>
            <div className="business-review-list">
              {reviewCards(business, likesCount).map((review) => (
                <article key={review.title}>
                  <div>
                    <Star size={15} fill="currentColor" />
                    <strong>{review.rating}</strong>
                  </div>
                  <h3>{review.title}</h3>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="business-detail-card" id="business-facilities">
            <SectionHeading title="Facilities" />
            {facilities.length ? (
              <div className="business-facility-list">
                {facilities.map((facility) => (
                  <span key={facility}>
                    <Check size={15} />
                    {facility}
                  </span>
                ))}
              </div>
            ) : (
              <p className="business-detail-muted">Facilities not added yet.</p>
            )}
          </section>

          {experiences.length ? (
            <section className="business-detail-card">
              <SectionHeading title="What to try" />
              <div className="business-experience-list">
                {experiences.slice(0, 4).map((experience) => (
                  <ExperienceRow key={experience.id} experience={experience} />
                ))}
              </div>
            </section>
          ) : null}

          {events.length ? (
            <section className="business-detail-card">
              <SectionHeading title="Upcoming events" />
              <div className="business-event-list">
                {events.slice(0, 3).map((event) => (
                  <article key={event.id}>
                    <CalendarCheck size={18} />
                    <div>
                      <h3>{event.title}</h3>
                      <span>{event.starts_at ? formatDateTime(event.starts_at) : event.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="business-detail-card" id="business-explore">
            <SectionHeading title="Explore more restaurants" />
            <div className="business-explore-chips">
              <span>Similar to {business.business_name}</span>
              {business.area ? <span>In {business.area}</span> : null}
              {business.business_subcategory ? <span>{business.business_subcategory}</span> : null}
              {primaryOffer ? <span>{offerLabel(primaryOffer)} or more</span> : null}
            </div>
            {related.length ? (
              <div className="business-related-list">
                {related.map((item) => (
                  <Link key={item.id} to={`/businesses/${item.business_id}`} state={{ businessPreview: item }}>
                    {item.image_url ? <img src={item.image_url} alt="" /> : <span><Utensils size={18} /></span>}
                    <strong>{item.business_name}</strong>
                    <small>{[item.area, item.city].filter(Boolean).join(', ') || item.location}</small>
                    {item.active_offer_title ? <em>{item.active_offer_title}</em> : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="business-detail-muted">More restaurants will appear as nearby listings grow.</p>
            )}
          </section>
        </main>

        <aside className="business-detail-side" />
      </div>

      <div className="business-sticky-actions">
        <a href={mapURL} target="_blank" rel="noreferrer">Google Map</a>
        {business.contact_phone || business.whatsapp_number ? (
          <a href={`tel:${business.contact_phone ?? business.whatsapp_number}`}>Call</a>
        ) : (
          <button type="button" onClick={shareBusiness}>Call</button>
        )}
      </div>

      {galleryOpen ? (
        <div className="business-gallery-overlay" role="dialog" aria-modal="true">
          <section className="business-gallery-panel">
            <header>
              <h2>Gallery</h2>
              <button className="icon-button quiet" type="button" aria-label="Close gallery" onClick={() => setGalleryOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="business-gallery-grid">
              {media.length ? (
                media.map((item) =>
                  item.media_type === 'video' ? (
                    <video key={item.id ?? item.cloudinary_public_id} controls playsInline src={item.secure_url} />
                  ) : (
                    <img key={item.id ?? item.cloudinary_public_id} src={item.secure_url} alt={item.alt_text ?? business.business_name} />
                  ),
                )
              ) : (
                <div className="business-detail-cover-fallback">
                  <Sparkles size={34} />
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function SectionHeading({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="business-detail-section-heading">
      <h2>{title}</h2>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  )
}

function ExperienceRow({ experience }: { experience: BusinessVenueExperience }) {
  const price = typeof experience.average_price_per_person === 'number'
    ? `${Math.round(experience.average_price_per_person)}/person`
    : typeof experience.starting_price === 'number'
      ? `From ${Math.round(experience.starting_price)}`
      : experience.category ?? 'Recommended'
  return (
    <article>
      <Utensils size={18} />
      <div>
        <h3>{experience.experience_name}</h3>
        {experience.description ? <p>{experience.description}</p> : null}
        <span>{price}</span>
      </div>
    </article>
  )
}

function businessMediaGallery(business: BusinessAccount | null) {
  if (!business) return []
  const media = [
    ...(business.media ?? []),
    ...(business.primary_venue?.media ?? []),
    ...((business.primary_venue?.experiences ?? []).flatMap((experience) => experience.media ?? [])),
  ]
  return media
    .filter((item, index, list) =>
      list.findIndex((candidate) => candidate.cloudinary_public_id === item.cloudinary_public_id) === index,
    )
    .sort((left, right) => {
      const leftCover = left.purpose === 'cover' ? 0 : 1
      const rightCover = right.purpose === 'cover' ? 0 : 1
      if (leftCover !== rightCover) return leftCover - rightCover
      return left.display_order - right.display_order
    })
}

function fullLocation(business: BusinessAccount) {
  return [
    business.address,
    business.area,
    business.city,
    business.location,
  ]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .join(', ')
}

function businessAddressLine(
  business: BusinessAccount,
  previewResult?: DiscoverySearchResult,
) {
  const address = fullLocation(business) || business.location
  const distanceLabel = businessDistanceLabel(business, previewResult)
  return [distanceLabel, address].filter(Boolean).join(' - ')
}

function businessDistanceLabel(
  business: BusinessAccount,
  previewResult?: DiscoverySearchResult,
) {
  if (!hasBusinessCoordinates(business)) return ''
  const previewDistance = previewResult?.business_id === business.id
    ? previewResult.distance_km
    : undefined
  const distanceKm = typeof previewDistance === 'number'
    ? previewDistance
    : distanceFromCachedLocation(business)
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) return ''
  return `${distanceKm.toFixed(1)}Km`
}

function distanceFromCachedLocation(business: BusinessAccount) {
  if (!hasBusinessCoordinates(business)) return undefined
  const cachedLocation = readBusinessDetailCachedLocation()
  if (!cachedLocation) return undefined
  return haversineDistanceKm(
    cachedLocation.latitude,
    cachedLocation.longitude,
    business.latitude,
    business.longitude,
  )
}

function hasBusinessCoordinates(
  business: BusinessAccount,
): business is BusinessAccount & { latitude: number; longitude: number } {
  return (
    typeof business.latitude === 'number' &&
    Number.isFinite(business.latitude) &&
    business.latitude >= -90 &&
    business.latitude <= 90 &&
    typeof business.longitude === 'number' &&
    Number.isFinite(business.longitude) &&
    business.longitude >= -180 &&
    business.longitude <= 180
  )
}

function readBusinessDetailCachedLocation() {
  try {
    const raw = localStorage.getItem(discoveryLocationCacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BusinessDetailCachedLocation>
    if (
      typeof parsed.latitude !== 'number' ||
      parsed.latitude < -90 ||
      parsed.latitude > 90 ||
      typeof parsed.longitude !== 'number' ||
      parsed.longitude < -180 ||
      parsed.longitude > 180 ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > discoveryLocationCacheMaxAgeMs
    ) {
      return null
    }
    return parsed as BusinessDetailCachedLocation
  } catch {
    return null
  }
}

function haversineDistanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(toLatitude - fromLatitude)
  const longitudeDelta = toRadians(toLongitude - fromLongitude)
  const fromLatitudeRad = toRadians(fromLatitude)
  const toLatitudeRad = toRadians(toLatitude)
  const halfChordLength =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRad) *
      Math.cos(toLatitudeRad) *
      Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength))
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function businessRating(likes: number) {
  if (likes >= 200) return '4.7'
  if (likes >= 75) return '4.6'
  if (likes >= 20) return '4.5'
  return '4.3'
}

function businessFromDiscoveryResult(result: DiscoverySearchResult): BusinessAccount {
  const now = new Date().toISOString()
  return {
    id: result.business_id,
    email: '',
    business_name: result.business_name || result.title,
    business_category: result.category,
    business_subcategory: result.subcategory,
    location: result.location,
    city: result.city,
    area: result.area,
    latitude: undefined,
    longitude: undefined,
    location_verified: result.verification_level !== 'unverified',
    verification_level: result.verification_level,
    price_range: result.price_range,
    mood_tags: result.mood_tags,
    service_tags: result.service_tags,
    best_for: result.best_for,
    facility_tags: result.tags,
    website_url: result.website_url,
    whatsapp_number: result.whatsapp_number,
    contact_phone: result.contact_phone,
    description: result.description,
    offerings: result.subcategory ?? result.category,
    opening_hours_schedule: [],
    open_now: result.open_now,
    media: result.image_url
      ? [{
          media_type: 'image',
          purpose: 'cover',
          cloudinary_public_id: `business-preview-${result.business_id}`,
          secure_url: result.image_url,
          display_order: 0,
        }]
      : [],
    onboarding_status: 'approved',
    account_status: 'active',
    created_at: now,
    updated_at: now,
  }
}

function plainText(value: unknown) {
  if (typeof value === 'string') return value.trim() || null
  return null
}

function todayHours(schedule: BusinessOpeningHour[]) {
  const today = new Date().getDay()
  const rows = (schedule ?? []).filter((item) => item.weekday === today)
  if (!rows.length) return null
  if (rows.some((item) => item.is_closed)) return 'Closed today'
  const intervals = rows
    .filter((item) => item.opens_at && item.closes_at)
    .sort((a, b) => a.interval_order - b.interval_order)
    .map((item) => `${item.opens_at}-${item.closes_at}`)
  return intervals.length ? intervals.join(', ') : null
}

function googleMapsURL(business: BusinessAccount) {
  if (typeof business.latitude === 'number' && typeof business.longitude === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.business_name} ${fullLocation(business)}`)}`
}

function offerLabel(offer: BusinessOffer) {
  if (typeof offer.discount_percent === 'number') return `${Math.round(offer.discount_percent)}% off`
  if (typeof offer.discount_amount === 'number') return `${currency(offer.discount_amount)} off`
  if (typeof offer.original_price === 'number' && typeof offer.offer_price === 'number') {
    return `Save ${currency(offer.original_price - offer.offer_price)}`
  }
  return offer.ends_on ? `Valid till ${offer.ends_on}` : 'Limited offer'
}

function sampleBillForOffer(offer: BusinessOffer | undefined, business: BusinessAccount | null) {
  const experience = business?.primary_venue?.experiences?.find(
    (item) => typeof item.average_price_per_person === 'number' || typeof item.starting_price === 'number',
  )
  const base = typeof offer?.original_price === 'number' && offer.original_price > 0
    ? offer.original_price
    : typeof experience?.average_price_per_person === 'number' && experience.average_price_per_person > 0
      ? experience.average_price_per_person * 2
      : typeof experience?.starting_price === 'number' && experience.starting_price > 0
        ? experience.starting_price * 2
        : typeof offer?.offer_price === 'number' && offer.offer_price > 0
          ? offer.offer_price
          : 0
  let saving = 0
  if (base > 0 && typeof offer?.offer_price === 'number' && offer.offer_price >= 0) {
    saving = Math.max(0, base - offer.offer_price)
  } else if (base > 0 && typeof offer?.discount_amount === 'number' && offer.discount_amount > 0) {
    saving = Math.min(base, offer.discount_amount)
  } else if (base > 0 && typeof offer?.discount_percent === 'number' && offer.discount_percent > 0) {
    saving = base * (Math.min(100, offer.discount_percent) / 100)
  }
  return {
    original: Math.round(base),
    saving: Math.round(Math.max(0, saving)),
    final: Math.round(Math.max(0, base - saving)),
    offerLabel: offer?.title ?? 'Estimated offer saving',
  }
}

function photoPurposeLabel(purpose: string) {
  switch (purpose) {
    case 'food':
    case 'menu':
      return 'Food photo'
    case 'cover':
    case 'gallery':
    case 'activity':
      return 'Bar photo'
    default:
      return 'Business photo'
  }
}

function reviewCards(business: BusinessAccount, likes: number) {
  return [
    {
      rating: '4.8',
      title: 'Popular nearby',
      text: likes > 0
        ? `${compactCount(likes)} Zumers users have shown interest in this place.`
        : 'Users are starting to discover this place on Zumers.',
    },
    {
      rating: business.location_verified ? '4.7' : '4.3',
      title: business.location_verified ? 'Location checked' : 'Location listed',
      text: fullLocation(business) || business.location,
    },
    {
      rating: business.open_now ? '4.6' : '4.2',
      title: business.open_now ? 'Good to visit now' : 'Plan ahead',
      text: business.best_for ?? business.description ?? 'A useful option to shortlist for your next plan.',
    },
  ]
}

function tagList(value?: string | null) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function priceRangeLabel(value?: BusinessAccount['price_range']) {
  switch (value) {
    case 'budget':
      return 'Budget'
    case 'moderate':
      return 'Moderate'
    case 'premium':
      return 'Premium'
    case 'luxury':
      return 'Luxury'
    default:
      return undefined
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function currency(value: number) {
  return `Rs. ${Math.round(value)}`
}

function compactCount(count: number) {
  if (count >= 1000000) return `${Math.round(count / 100000) / 10}M`
  if (count >= 1000) return `${Math.round(count / 100) / 10}K`
  return String(count)
}

function loadSavedBusinesses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedBusinessesKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is number => typeof item === 'number')
  } catch {
    return []
  }
}

function toggleSavedBusiness(businessID: number) {
  const current = loadSavedBusinesses()
  const next = current.includes(businessID)
    ? current.filter((id) => id !== businessID)
    : [businessID, ...current]
  localStorage.setItem(savedBusinessesKey, JSON.stringify(next))
  return next
}
