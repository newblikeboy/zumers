import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  ForkKnife,
  ImagePlus,
  LocateFixed,
  LogOut,
  MapPin,
  Menu,
  Megaphone,
  Percent,
  Save,
  Store,
  Ticket,
  Users,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ErrorBanner } from '../components/ErrorBanner'
import businessHero from '../assets/zumers-business-hero.png'
import { businessApi } from '../lib/api'
import { businessPath } from '../lib/businessRoutes'
import { cloudinaryDeliveryUrl, uploadToCloudinary } from '../lib/cloudinary'
import type {
  BusinessAccount,
  BusinessDashboard,
  BusinessDuplicateMatch,
  BusinessMedia,
  BusinessOpeningHour,
  BusinessTaxonomyCategory,
  BusinessTaxonomyTag,
  BusinessVenueExperience,
} from '../lib/types'

type BusinessLocationValue = {
  location: string
  address: string
  city: string
  area: string
  postal_code: string
  google_place_id: string
  state: string
  country: string
  district: string
  landmark: string
  latitude: string
  longitude: string
  location_accuracy_meters: string
}

type GoogleGeocodeAddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

type GoogleGeocodeResult = {
  formatted_address?: string
  address_components?: GoogleGeocodeAddressComponent[]
  place_id?: string
}

type GoogleMapsGeocoder = {
  geocode: (
    request: { location: { lat: number; lng: number } },
    callback: (results: GoogleGeocodeResult[] | null, status: string) => void,
  ) => void
}

type GoogleMapsWindow = {
  maps: {
    Geocoder: new () => GoogleMapsGeocoder
    GeocoderStatus: {
      OK: string
    }
  }
}

declare global {
  interface Window {
    google?: GoogleMapsWindow
  }
}

let googleMapsLoader: Promise<GoogleMapsWindow> | null = null

const businessTypes = [
  { icon: Utensils, title: 'Street food', text: 'Food carts, local stalls, snacks, and late-night favorites.' },
  { icon: ForkKnife, title: 'Restaurants', text: 'Cafes, family restaurants, premium dining, and hidden gems.' },
  { icon: Bus, title: 'Travel', text: 'Tours, buses, stays, local rides, and weekend trip operators.' },
  { icon: CalendarDays, title: 'Events', text: 'Workshops, shows, meetups, pop-ups, and seasonal experiences.' },
]

const fallbackBusinessCategories: BusinessTaxonomyCategory[] = [
  {
    id: 1,
    slug: 'street-food',
    name: 'Street food',
    subcategories: [
      { id: 1, slug: 'chaat', name: 'Chaat' },
      { id: 2, slug: 'momos', name: 'Momos' },
      { id: 3, slug: 'rolls', name: 'Rolls' },
      { id: 4, slug: 'golgappe', name: 'Golgappe' },
      { id: 5, slug: 'kebab-tandoor', name: 'Kebab / Tandoor' },
      { id: 6, slug: 'street-food-market', name: 'Street Food Market' },
    ],
  },
  {
    id: 2,
    slug: 'restaurant-or-cafe',
    name: 'Restaurant or cafe',
    subcategories: [
      { id: 7, slug: 'restaurant', name: 'Restaurant' },
      { id: 8, slug: 'cafe', name: 'Cafe' },
      { id: 9, slug: 'rooftop-cafe', name: 'Rooftop Cafe' },
      { id: 10, slug: 'fine-dining', name: 'Fine Dining' },
      { id: 11, slug: 'family-restaurant', name: 'Family Restaurant' },
      { id: 12, slug: 'bakery', name: 'Bakery' },
    ],
  },
  {
    id: 3,
    slug: 'fun-and-entertainment',
    name: 'Fun and entertainment',
    subcategories: [
      { id: 13, slug: 'cinema', name: 'Cinema' },
      { id: 14, slug: 'bowling', name: 'Bowling' },
      { id: 15, slug: 'gaming-zone', name: 'Gaming Zone' },
      { id: 16, slug: 'arcade', name: 'Arcade' },
      { id: 17, slug: 'escape-room', name: 'Escape Room' },
      { id: 18, slug: 'kids-play-area', name: 'Kids Play Area' },
    ],
  },
  {
    id: 4,
    slug: 'adventure',
    name: 'Adventure',
    subcategories: [
      { id: 19, slug: 'go-karting', name: 'Go Karting' },
      { id: 20, slug: 'trampoline-park', name: 'Trampoline Park' },
      { id: 21, slug: 'paintball', name: 'Paintball' },
      { id: 22, slug: 'water-park', name: 'Water Park' },
      { id: 23, slug: 'trekking', name: 'Trekking' },
      { id: 24, slug: 'camping', name: 'Camping' },
    ],
  },
  {
    id: 5,
    slug: 'nightlife',
    name: 'Nightlife',
    subcategories: [
      { id: 25, slug: 'club', name: 'Club' },
      { id: 26, slug: 'pub', name: 'Pub' },
      { id: 27, slug: 'lounge', name: 'Lounge' },
      { id: 28, slug: 'live-music', name: 'Live Music' },
      { id: 29, slug: 'rooftop-bar', name: 'Rooftop Bar' },
      { id: 30, slug: 'dj-night', name: 'DJ Night' },
    ],
  },
  {
    id: 6,
    slug: 'culture-and-events',
    name: 'Culture and events',
    subcategories: [
      { id: 31, slug: 'theatre', name: 'Theatre' },
      { id: 32, slug: 'museum', name: 'Museum' },
      { id: 33, slug: 'workshop', name: 'Workshop' },
      { id: 34, slug: 'concert', name: 'Concert' },
      { id: 35, slug: 'stand-up-comedy', name: 'Stand-up Comedy' },
      { id: 36, slug: 'heritage-walk', name: 'Heritage Walk' },
    ],
  },
  {
    id: 7,
    slug: 'sports-and-fitness',
    name: 'Sports and fitness',
    subcategories: [
      { id: 37, slug: 'badminton', name: 'Badminton' },
      { id: 38, slug: 'cricket-turf', name: 'Cricket Turf' },
      { id: 39, slug: 'football-turf', name: 'Football Turf' },
      { id: 40, slug: 'swimming', name: 'Swimming' },
      { id: 41, slug: 'gym', name: 'Gym' },
      { id: 42, slug: 'yoga', name: 'Yoga' },
    ],
  },
  {
    id: 8,
    slug: 'relax-and-explore',
    name: 'Relax and explore',
    subcategories: [
      { id: 43, slug: 'park', name: 'Park' },
      { id: 44, slug: 'garden', name: 'Garden' },
      { id: 45, slug: 'lake', name: 'Lake' },
      { id: 46, slug: 'resort', name: 'Resort' },
      { id: 47, slug: 'picnic-spot', name: 'Picnic Spot' },
      { id: 48, slug: 'viewpoint', name: 'Viewpoint' },
    ],
  },
  {
    id: 9,
    slug: 'travel-or-transport',
    name: 'Travel or transport',
    subcategories: [
      { id: 49, slug: 'weekend-trip', name: 'Weekend Trip' },
      { id: 50, slug: 'tour-operator', name: 'Tour Operator' },
      { id: 51, slug: 'local-ride', name: 'Local Ride' },
      { id: 52, slug: 'city-tour', name: 'City Tour' },
      { id: 53, slug: 'cab-rental', name: 'Cab Rental' },
      { id: 54, slug: 'bike-rental', name: 'Bike Rental' },
    ],
  },
  {
    id: 10,
    slug: 'attractions-and-heritage',
    name: 'Attractions and heritage',
    subcategories: [
      { id: 55, slug: 'monument', name: 'Monument' },
      { id: 56, slug: 'heritage-site', name: 'Heritage Site' },
      { id: 57, slug: 'temple', name: 'Temple / Religious Place' },
      { id: 58, slug: 'photo-spot', name: 'Photo Spot' },
    ],
  },
  {
    id: 11,
    slug: 'shopping-and-markets',
    name: 'Shopping and markets',
    subcategories: [
      { id: 59, slug: 'mall', name: 'Mall' },
      { id: 60, slug: 'local-market', name: 'Local Market' },
      { id: 61, slug: 'flea-market', name: 'Flea Market' },
      { id: 62, slug: 'night-market', name: 'Night Market' },
    ],
  },
  {
    id: 12,
    slug: 'wellness-and-self-care',
    name: 'Wellness and self care',
    subcategories: [
      { id: 63, slug: 'spa', name: 'Spa' },
      { id: 64, slug: 'salon', name: 'Salon' },
      { id: 65, slug: 'massage', name: 'Massage' },
      { id: 66, slug: 'yoga-studio', name: 'Yoga Studio' },
    ],
  },
  {
    id: 13,
    slug: 'learning-and-hobbies',
    name: 'Learning and hobbies',
    subcategories: [
      { id: 67, slug: 'art-class', name: 'Art Class' },
      { id: 68, slug: 'dance-class', name: 'Dance Class' },
      { id: 69, slug: 'music-class', name: 'Music Class' },
      { id: 70, slug: 'cooking-class', name: 'Cooking Class' },
    ],
  },
  {
    id: 14,
    slug: 'other-local-service',
    name: 'Other local service',
    subcategories: [
      { id: 71, slug: 'event-planner', name: 'Event Planner' },
      { id: 72, slug: 'photographer', name: 'Photographer' },
      { id: 73, slug: 'equipment-rental', name: 'Equipment Rental' },
      { id: 74, slug: 'other-experience', name: 'Other Experience' },
    ],
  },
]

const fallbackBusinessTags: BusinessTaxonomyTag[] = [
  { id: 1, type: 'mood', slug: 'chill', name: 'Chill' },
  { id: 2, type: 'mood', slug: 'fun', name: 'Fun' },
  { id: 3, type: 'mood', slug: 'romantic', name: 'Romantic' },
  { id: 4, type: 'mood', slug: 'peaceful', name: 'Peaceful' },
  { id: 5, type: 'mood', slug: 'late-night', name: 'Late Night' },
  { id: 6, type: 'service', slug: 'breakfast', name: 'Breakfast' },
  { id: 7, type: 'service', slug: 'dinner', name: 'Dinner' },
  { id: 8, type: 'service', slug: 'coffee', name: 'Coffee' },
  { id: 9, type: 'service', slug: 'live-music', name: 'Live Music' },
  { id: 10, type: 'service', slug: 'quick-bite', name: 'Quick Bite' },
  { id: 11, type: 'audience', slug: 'friends', name: 'Friends' },
  { id: 12, type: 'audience', slug: 'couples', name: 'Couples' },
  { id: 13, type: 'audience', slug: 'family', name: 'Family' },
  { id: 14, type: 'audience', slug: 'large-groups', name: 'Large Groups' },
  { id: 15, type: 'facility', slug: 'parking', name: 'Parking' },
  { id: 16, type: 'facility', slug: 'washroom', name: 'Washroom' },
  { id: 17, type: 'facility', slug: 'air-conditioning', name: 'Air Conditioning' },
  { id: 18, type: 'facility', slug: 'outdoor-seating', name: 'Outdoor Seating' },
]

const onboardingSteps = [
  'Business identity and owner contact',
  'Category, timings, service area, and location',
  'Photos, videos, menu, packages, or ticket details',
  'Verification, visibility settings, and offers',
]

const successStories = [
  {
    name: 'Local food counter',
    category: 'Street food',
    result: 'Turned daily specials into repeat evening visits.',
    metric: 'Daily updates',
  },
  {
    name: 'Neighborhood cafe',
    category: 'Restaurant',
    result: 'Used live offers to bring customers during quiet hours.',
    metric: 'Offer clicks',
  },
  {
    name: 'Weekend trip operator',
    category: 'Travel',
    result: 'Made packages easier for groups to discover and book.',
    metric: 'Booking intent',
  },
]

const onboardingBusinesses = [
  { name: 'Johri Restaurant', category: 'Restaurant or cafe', location: 'Rajouri Garden, New Delhi' },
  { name: 'Street bites partner', category: 'Street food', location: 'Delhi NCR' },
  { name: 'Weekend travel host', category: 'Travel or transport', location: 'North India' },
]

type BusinessAuthMode = 'signup' | 'login'
type BusinessPageMode = 'landing' | 'dashboard'
type BusinessDashboardSection = 'overview' | 'today' | 'offers' | 'bookings' | 'profile'
type BusinessOnboardingStep = 'identity' | 'location' | 'contact' | 'discovery' | 'media' | 'hours' | 'preview'

const businessDashboardSections = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'today', label: 'Today update', icon: Megaphone },
  { id: 'offers', label: 'Offers', icon: Percent },
  { id: 'bookings', label: 'Bookings', icon: Ticket },
  { id: 'profile', label: 'Business profile', icon: Building2 },
] satisfies Array<{ id: BusinessDashboardSection; label: string; icon: typeof BarChart3 }>

const businessDashboardNavigation = [
  { label: 'Workspace', items: ['overview', 'today'] },
  { label: 'Engagement', items: ['offers', 'bookings'] },
  { label: 'Business', items: ['profile'] },
] satisfies Array<{ label: string; items: BusinessDashboardSection[] }>

const businessOnboardingSteps = [
  { id: 'identity', label: 'Identity' },
  { id: 'location', label: 'Location' },
  { id: 'contact', label: 'Contact' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'media', label: 'Media' },
  { id: 'hours', label: 'Hours' },
  { id: 'preview', label: 'Preview' },
] satisfies Array<{ id: BusinessOnboardingStep; label: string }>

const businessWeekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

type BusinessPageProps = {
  mode: BusinessPageMode
  initialAuth?: BusinessAuthMode
}

export function BusinessPage({ mode, initialAuth }: BusinessPageProps) {
  const [business, setBusiness] = useState<BusinessAccount | null>(null)
  const [dashboard, setDashboard] = useState<BusinessDashboard | null>(null)
  const [authMode, setAuthMode] = useState<BusinessAuthMode | null>(initialAuth ?? null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [checkedSession, setCheckedSession] = useState(false)
  const [dashboardSection, setDashboardSection] = useState<BusinessDashboardSection>('overview')
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<BusinessOnboardingStep>('identity')
  const [businessDuplicateMatches, setBusinessDuplicateMatches] = useState<BusinessDuplicateMatch[]>([])
  const [businessCategories, setBusinessCategories] =
    useState<BusinessTaxonomyCategory[]>(fallbackBusinessCategories)
  const [businessTags, setBusinessTags] = useState<BusinessTaxonomyTag[]>(fallbackBusinessTags)
  const navigate = useNavigate()

  useEffect(() => {
    setAuthMode(initialAuth ?? null)
  }, [initialAuth])

  useEffect(() => {
    businessApi.me()
      .then(setBusiness)
      .catch(() => undefined)
      .finally(() => setCheckedSession(true))
  }, [])

  useEffect(() => {
    businessApi.taxonomy()
      .then((taxonomy) => {
        if (taxonomy.categories.length) {
          setBusinessCategories(taxonomy.categories)
        }
        if (taxonomy.tags.length) {
          setBusinessTags(taxonomy.tags)
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (mode !== 'dashboard' || !business) {
      return
    }

    businessApi.dashboard()
      .then(setDashboard)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load business dashboard')
      })
  }, [mode, business])

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('signup')
    setError(null)
    setSuccess(null)
    setBusinessDuplicateMatches([])
    const form = new FormData(event.currentTarget)
    try {
      const duplicateCheck = await businessApi.duplicateCheck({
        business_name: String(form.get('business_name')),
        location: String(form.get('location')),
      })
      if (duplicateCheck.matches.length) {
        setBusinessDuplicateMatches(duplicateCheck.matches)
        setError(
          duplicateCheck.exact_match
            ? 'This business already exists on Zumers. Claim the existing business instead.'
            : 'A similar business already exists on Zumers. Check it before creating a duplicate.',
        )
        return
      }
      const response = await businessApi.signup({
        business_name: String(form.get('business_name')),
        business_category: String(form.get('business_category')),
        business_subcategory: String(form.get('business_subcategory')),
        location: String(form.get('location')),
        contact_phone: String(form.get('contact_phone')),
        email: String(form.get('email')),
        password: String(form.get('password')),
      })
      setBusiness(response.business)
      navigate(businessPath('/dashboard'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Business signup failed')
    } finally {
      setBusy(null)
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('login')
    setError(null)
    setSuccess(null)
    const form = new FormData(event.currentTarget)
    try {
      const response = await businessApi.login({
        email: String(form.get('email')),
        password: String(form.get('password')),
      })
      setBusiness(response.business)
      navigate(businessPath('/dashboard'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Business login failed')
    } finally {
      setBusy(null)
    }
  }

  async function saveOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const onboardingStatus = onboardingSubmitStatus(event)
    setBusy(`onboarding-${onboardingStatus}`)
    setError(null)
    setSuccess(null)
    const form = new FormData(event.currentTarget)
    const openingHoursSchedule = businessOpeningHoursFromForm(form)
    const venueExperiences = businessVenueExperiencesFromForm(form)
    const businessMedia = businessMediaFromForm(form, 'business_media_json')
    const venueMedia = businessMediaFromForm(form, 'venue_media_json')
    try {
      const updated = await businessApi.update({
        business_name: String(form.get('business_name')),
        business_category: String(form.get('business_category')),
        business_subcategory: String(form.get('business_subcategory')),
        location: String(form.get('location')),
        address: String(form.get('address')),
        city: String(form.get('city')),
        area: String(form.get('area')),
        postal_code: String(form.get('postal_code')),
        google_place_id: String(form.get('google_place_id')),
        state: String(form.get('state')),
        country: String(form.get('country')),
        district: String(form.get('district')),
        landmark: String(form.get('landmark')),
        latitude: optionalNumber(form.get('latitude')),
        longitude: optionalNumber(form.get('longitude')),
        location_accuracy_meters: optionalNumber(form.get('location_accuracy_meters')),
        service_radius_km: optionalNumber(form.get('service_radius_km')),
        price_range: optionalPriceRange(form.get('price_range')),
        mood_tags: String(form.get('mood_tags')),
        service_tags: String(form.get('service_tags')),
        best_for: String(form.get('best_for')),
        facility_tags: String(form.get('facility_tags')),
        website_url: String(form.get('website_url')),
        whatsapp_number: String(form.get('whatsapp_number')),
        contact_phone: String(form.get('contact_phone')),
        description: String(form.get('description')),
        offerings: String(form.get('offerings')),
        opening_hours: formatBusinessOpeningHours(openingHoursSchedule),
        opening_hours_schedule: openingHoursSchedule,
        business_media: businessMedia,
        venue_experiences: venueExperiences,
        venue_media: venueMedia,
        onboarding_status: onboardingStatus,
      })
      setBusiness(updated)
      setSuccess(onboardingStatus === 'submitted' ? 'Business onboarding submitted.' : 'Business draft saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save onboarding')
    } finally {
      setBusy(null)
    }
  }

  async function saveTodayUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('today')
    setError(null)
    setSuccess(null)
    const form = new FormData(event.currentTarget)
    try {
      const updated = await businessApi.updateDashboard({
        today_update: String(form.get('today_update')),
        today_highlight: String(form.get('today_highlight')),
      })
      setDashboard(updated)
      setSuccess('Today update saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save today update')
    } finally {
      setBusy(null)
    }
  }

  async function saveOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('offer')
    setError(null)
    setSuccess(null)
    const form = new FormData(event.currentTarget)
    try {
      const updated = await businessApi.updateDashboard({
        offer_id: dashboard?.offer_id,
        offer_title: String(form.get('offer_title')),
        offer_details: String(form.get('offer_details')),
        offer_valid_until: String(form.get('valid_until')),
        offer_status: 'active',
      })
      setDashboard(updated)
      setSuccess('Live offer saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save live offer')
    } finally {
      setBusy(null)
    }
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('event')
    setError(null)
    setSuccess(null)
    const form = new FormData(event.currentTarget)
    try {
      const updated = await businessApi.updateDashboard({
        event_title: String(form.get('event_title')),
        event_details: String(form.get('event_details')),
        event_type: String(form.get('event_type')),
        event_starts_at: String(form.get('event_starts_at')),
        event_ends_at: String(form.get('event_ends_at')),
        event_status: 'scheduled',
      })
      setDashboard(updated)
      setSuccess('Event saved.')
      event.currentTarget.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save event')
    } finally {
      setBusy(null)
    }
  }

  function logout() {
    businessApi.logout()
    setBusiness(null)
    navigate(businessPath())
  }

  function openAuth(modeToOpen: BusinessAuthMode) {
    setError(null)
    setSuccess(null)
    setBusinessDuplicateMatches([])
    setAuthMode(modeToOpen)
  }

  function closeAuth() {
    setError(null)
    setAuthMode(null)
    if (initialAuth) {
      navigate(businessPath(), { replace: true })
    }
  }

  function selectDashboardSection(section: BusinessDashboardSection) {
    setDashboardSection(section)
    setDashboardMenuOpen(false)
  }

  if (mode === 'dashboard' && !checkedSession) {
    return <div className="boot-screen">Loading business dashboard</div>
  }

  if (mode === 'dashboard' && checkedSession && !business) {
    return <Navigate to={businessPath()} replace />
  }

  if (mode === 'dashboard' && business) {
    const activeDashboardSection =
      businessDashboardSections.find((section) => section.id === dashboardSection) ?? businessDashboardSections[0]
    const dashboardStats = [
      { icon: BarChart3, label: 'Offer clicks', value: dashboard?.offer_clicks ?? 0, hint: 'Today' },
      { icon: Users, label: 'Profile visits', value: dashboard?.profile_visits ?? 0, hint: 'Last 24 hours' },
      { icon: Ticket, label: 'Bookings', value: dashboard?.bookings.length ?? 0, hint: 'Pending' },
      { icon: BadgeCheck, label: 'Saves', value: dashboard?.saves ?? 0, hint: 'This week' },
      { icon: Percent, label: 'Active offers', value: (dashboard?.offers ?? []).filter((offer) => offer.status === 'active').length, hint: 'Published' },
      { icon: CalendarDays, label: 'Events', value: (dashboard?.events ?? []).filter((event) => event.status === 'active' || event.status === 'scheduled').length, hint: 'Upcoming' },
    ]
    const activeOnboardingIndex = businessOnboardingSteps.findIndex((step) => step.id === onboardingStep)
    const onboardingCompletion = businessProfileCompleteness(business)
    const completionTasks = businessProfileCompletionTasks(business)
    const onboardingStepClass = (step: BusinessOnboardingStep) =>
      onboardingStep === step ? 'business-onboarding-step active' : 'business-onboarding-step'
    const goToOnboardingStep = (direction: -1 | 1) => {
      const nextIndex = Math.min(
        Math.max(activeOnboardingIndex + direction, 0),
        businessOnboardingSteps.length - 1,
      )
      setOnboardingStep(businessOnboardingSteps[nextIndex].id)
    }

    return (
      <main className={dashboardMenuOpen ? 'business-dashboard-shell menu-open' : 'business-dashboard-shell'}>
        {dashboardMenuOpen ? (
          <button
            aria-label="Close business menu"
            className="business-dashboard-backdrop"
            type="button"
            onClick={() => setDashboardMenuOpen(false)}
          />
        ) : null}
        <aside className="business-dashboard-sidebar">
          <Link className="business-dashboard-brand" to={businessPath()}>
            <span>Z</span>
            <strong>Zumers Business</strong>
          </Link>
          <nav aria-label="Business dashboard sections">
            {businessDashboardNavigation.map((group) => (
              <div className="business-dashboard-nav-group" key={group.label}>
                <span>{group.label}</span>
                {group.items.map((sectionID) => {
                  const item = businessDashboardSections.find((section) => section.id === sectionID)
                  if (!item) return null
                  const SectionIcon = item.icon
                  return (
                    <button
                      key={item.id}
                      className={dashboardSection === item.id ? 'active' : ''}
                      type="button"
                      onClick={() => selectDashboardSection(item.id)}
                    >
                      <SectionIcon size={18} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
          <button className="business-dashboard-logout" type="button" onClick={logout}>
            <LogOut size={18} /> Logout
          </button>
        </aside>

        <section className="business-dashboard-main">
          <header className="business-dashboard-top">
            <div className="business-dashboard-top-title">
              <button
                aria-label="Open business menu"
                className="business-dashboard-menu-button"
                type="button"
                onClick={() => setDashboardMenuOpen((open) => !open)}
              >
                <Menu size={22} />
              </button>
              <div>
                <p className="business-label">{activeDashboardSection.label}</p>
                <h1>{business.business_name}</h1>
                <span>{business.business_category} - {business.location}</span>
              </div>
            </div>
            <div className="business-verification-pill">
              <BadgeCheck size={17} />
              <span>{businessVerificationLabel(business.verification_level ?? 'unverified')}</span>
            </div>
          </header>

          <ErrorBanner message={error} />
          {success ? <div className="business-success">{success}</div> : null}

          {dashboardSection === 'overview' ? (
            <>
              <section className="business-stat-grid" aria-label="Business performance">
                {dashboardStats.map((stat) => (
                  <article key={stat.label}>
                    <stat.icon size={22} />
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                    <small>{stat.hint}</small>
                  </article>
                ))}
              </section>

              <section className="business-control-grid business-control-grid-single">
                <article className="business-control-panel">
                  <div className="business-panel-heading">
                    <BarChart3 size={24} />
                    <div>
                      <p className="business-label">Tracking</p>
                      <h2>Offer performance</h2>
                    </div>
                  </div>
                  <div className="business-tracking-list">
                    <div>
                      <span>Live offer clicks</span>
                      <strong>{dashboard?.offer_clicks ?? 0}</strong>
                    </div>
                    <div>
                      <span>Booking intent clicks</span>
                      <strong>{dashboard?.booking_clicks ?? 0}</strong>
                    </div>
                    <div>
                      <span>Direction clicks</span>
                      <strong>{dashboard?.direction_clicks ?? 0}</strong>
                    </div>
                  </div>
                </article>
              </section>
            </>
          ) : null}

          {dashboardSection === 'today' ? (
            <section className="business-control-grid business-control-grid-single">
              <article className="business-control-panel">
                <div className="business-panel-heading">
                  <Megaphone size={24} />
                  <div>
                    <p className="business-label">What is new today</p>
                    <h2>Post a fresh business update</h2>
                  </div>
                </div>
                <form className="business-form-preview" onSubmit={saveTodayUpdate}>
                  <label>
                    Today message
                    <textarea
                      name="today_update"
                      defaultValue={dashboard?.today_update ?? ''}
                      placeholder="Example: Live music tonight from 8 PM, new tandoori platter, or seats available for dinner."
                    />
                  </label>
                  <label>
                    Highlight
                    <input
                      name="today_highlight"
                      defaultValue={dashboard?.today_highlight ?? ''}
                      placeholder="Example: Dinner special, new menu, weekend trip"
                    />
                  </label>
                  <button className="business-primary" disabled={busy === 'today'}>
                    <Save size={18} />
                    {busy === 'today' ? 'Saving update' : 'Save today update'}
                  </button>
                </form>
              </article>
            </section>
          ) : null}

          {dashboardSection === 'offers' ? (
            <section className="business-control-grid">
              <article className="business-control-panel">
                <div className="business-panel-heading">
                  <Percent size={24} />
                  <div>
                    <p className="business-label">Offers</p>
                    <h2>Publish discount or deal</h2>
                  </div>
                </div>
                <form className="business-form-preview" onSubmit={saveOffer}>
                  <label>
                    Offer title
                    <input
                      name="offer_title"
                      defaultValue={dashboard?.offer_title ?? ''}
                      placeholder="Example: 20% off lunch buffet"
                    />
                  </label>
                  <label>
                    Offer details
                    <textarea
                      name="offer_details"
                      defaultValue={dashboard?.offer_details ?? ''}
                      placeholder="Tell users what is included and how to claim it."
                    />
                  </label>
                  <label>
                    Valid until
                    <input
                      name="valid_until"
                      defaultValue={dashboard?.offer_valid_until ?? ''}
                      type="date"
                    />
                  </label>
                  <button className="business-primary" disabled={busy === 'offer'}>
                    <Save size={18} />
                    {busy === 'offer' ? 'Saving offer' : 'Save live offer'}
                  </button>
                </form>
                {dashboard?.offers?.length ? (
                  <div className="business-record-list">
                    {dashboard.offers.map((offer) => (
                      <div key={offer.id}>
                        <strong>{offer.title}</strong>
                        <span>{offer.description ?? 'Business offer'}</span>
                        <small>
                          {offer.status}
                          {offer.ends_on ? ` - valid until ${offer.ends_on}` : ''}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>

              <article className="business-control-panel">
                <div className="business-panel-heading">
                  <CalendarDays size={24} />
                  <div>
                    <p className="business-label">Events</p>
                    <h2>Add temporary event</h2>
                  </div>
                </div>
                <form className="business-form-preview" onSubmit={saveEvent}>
                  <label>
                    Event title
                    <input
                      name="event_title"
                      placeholder="Example: Live music night, workshop, screening"
                    />
                  </label>
                  <label>
                    Event type
                    <input
                      name="event_type"
                      placeholder="Example: Live music, comedy, workshop"
                    />
                  </label>
                  <label>
                    Event details
                    <textarea
                      name="event_details"
                      placeholder="Tell users what is happening, who it is for, and what to expect."
                    />
                  </label>
                  <label>
                    Starts at
                    <input name="event_starts_at" type="datetime-local" />
                  </label>
                  <label>
                    Ends at
                    <input name="event_ends_at" type="datetime-local" />
                  </label>
                  <button className="business-primary" disabled={busy === 'event'}>
                    <Save size={18} />
                    {busy === 'event' ? 'Saving event' : 'Save event'}
                  </button>
                </form>
                {dashboard?.events?.length ? (
                  <div className="business-record-list">
                    {dashboard.events.map((businessEvent) => (
                      <div key={businessEvent.id}>
                        <strong>{businessEvent.title}</strong>
                        <span>{businessEvent.description ?? businessEvent.event_type ?? 'Business event'}</span>
                        <small>
                          {businessEvent.status}
                          {businessEvent.starts_at ? ` - ${formatDashboardDateTime(businessEvent.starts_at)}` : ''}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            </section>
          ) : null}

          {dashboardSection === 'bookings' ? (
            <section className="business-control-grid business-control-grid-single">
              <article className="business-control-panel">
                <div className="business-panel-heading">
                  <Ticket size={24} />
                  <div>
                    <p className="business-label">Bookings</p>
                    <h2>User booking requests</h2>
                  </div>
                </div>
                {dashboard?.bookings.length ? (
                  <div className="business-booking-list">
                    {dashboard.bookings.map((booking) => (
                      <div key={booking.id}>
                        <strong>{booking.requester_name}</strong>
                        <span>{booking.booking_note ?? 'Booking request'}</span>
                        <span className="business-booking-detail">
                          {booking.requester_contact ? `Contact: ${booking.requester_contact}` : 'No contact shared'}
                        </span>
                        {booking.booking_time ? (
                          <span className="business-booking-detail">
                            Preferred: {formatDashboardDateTime(booking.booking_time)}
                          </span>
                        ) : null}
                        <small>{booking.status}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="business-booking-empty">
                    <ClipboardList size={30} />
                    <strong>No booking requests yet</strong>
                    <span>When users book tables, trips, tickets, or events, requests will appear here.</span>
                  </div>
                )}
              </article>
            </section>
          ) : null}

          {dashboardSection === 'profile' ? (
            <section className="business-control-panel">
              <div className="business-panel-heading">
                <Building2 size={24} />
                <div>
                  <p className="business-label">Onboarding</p>
                  <h2>Business details</h2>
                </div>
              </div>
              <div className="business-onboarding-progress">
                <div>
                  <span>Profile completeness</span>
                  <strong>{onboardingCompletion}%</strong>
                </div>
                <progress value={onboardingCompletion} max={100} />
                {completionTasks.length ? (
                  <ul>
                    {completionTasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Core visibility items are complete. Keep offers, events, and media fresh.</p>
                )}
              </div>
              <nav className="business-onboarding-steps" aria-label="Business onboarding steps">
                {businessOnboardingSteps.map((step, index) => (
                  <button
                    key={step.id}
                    className={step.id === onboardingStep ? 'active' : ''}
                    type="button"
                    onClick={() => setOnboardingStep(step.id)}
                  >
                    <span>{index + 1}</span>
                    {step.label}
                  </button>
                ))}
              </nav>
              <form className="business-form-preview business-onboarding-form" onSubmit={saveOnboarding}>
                <div className={onboardingStepClass('identity')}>
                  <div className="business-form-section-title">
                    <h3>Business identity</h3>
                    <p>Core details users and the discovery engine use to understand the business.</p>
                  </div>
                  <label>
                    Business name
                    <input name="business_name" defaultValue={business.business_name} required />
                  </label>
                  <BusinessCategoryFields
                    categories={businessCategories}
                    initialCategory={business.business_category}
                    initialSubcategory={business.business_subcategory ?? ''}
                  />
                </div>
                <div className={onboardingStepClass('location')}>
                  <div className="business-form-section-title">
                    <h3>Location intelligence</h3>
                    <p>Structured place data for nearby search, maps, and future directions tracking.</p>
                  </div>
                  <label>
                    Location summary
                    <BusinessCurrentLocationPicker
                      initialValue={businessLocationValue(business)}
                      required
                    />
                  </label>
                  <label>
                    Service radius
                    <input
                      name="service_radius_km"
                      defaultValue={business.service_radius_km ?? ''}
                      inputMode="decimal"
                      min="0"
                      placeholder="Kilometers"
                      step="0.1"
                      type="number"
                    />
                  </label>
                </div>
                <div className={onboardingStepClass('contact')}>
                  <div className="business-form-section-title">
                    <h3>Pricing and contact</h3>
                    <p>How users can evaluate cost and reach the business from a search result.</p>
                  </div>
                  <label>
                    Price range
                    <select name="price_range" defaultValue={business.price_range ?? ''}>
                      <option value="">Select price range</option>
                      <option value="budget">Budget</option>
                      <option value="moderate">Moderate</option>
                      <option value="premium">Premium</option>
                      <option value="luxury">Luxury</option>
                    </select>
                  </label>
                  <label>
                    Contact phone
                    <input name="contact_phone" defaultValue={business.contact_phone ?? ''} />
                  </label>
                  <label>
                    WhatsApp number
                    <input
                      name="whatsapp_number"
                      defaultValue={business.whatsapp_number ?? ''}
                      placeholder="Number for customer enquiries"
                    />
                  </label>
                  <label>
                    Website or menu link
                    <input
                      name="website_url"
                      defaultValue={business.website_url ?? ''}
                      placeholder="https://..."
                      type="url"
                    />
                  </label>
                </div>
                <div className={onboardingStepClass('discovery')}>
                  <div className="business-form-section-title">
                    <h3>Discovery content</h3>
                    <p>Structured signals that connect the business to user intent.</p>
                  </div>
                  <label>
                    Business description
                    <textarea
                      name="description"
                      defaultValue={business.description ?? ''}
                      placeholder="Tell users what makes this place worth visiting."
                    />
                  </label>
                  <label>
                    Menu, packages, events, or services
                    <textarea
                      name="offerings"
                      defaultValue={business.offerings ?? ''}
                      placeholder="Popular dishes, travel packages, event details, offers, or services."
                    />
                  </label>
                  <BusinessTagMultiSelect
                    label="Mood tags"
                    name="mood_tags"
                    options={businessTags.filter((tag) => tag.type === 'mood')}
                    value={business.mood_tags ?? ''}
                  />
                  <BusinessTagMultiSelect
                    label="Service tags"
                    name="service_tags"
                    options={businessTags.filter((tag) => tag.type === 'service')}
                    value={business.service_tags ?? ''}
                  />
                  <BusinessTagMultiSelect
                    label="Best for"
                    name="best_for"
                    options={businessTags.filter((tag) => tag.type === 'audience')}
                    value={business.best_for ?? ''}
                  />
                  <BusinessTagMultiSelect
                    label="Facilities"
                    name="facility_tags"
                    options={businessTags.filter((tag) => tag.type === 'facility')}
                    value={business.facility_tags ?? ''}
                  />
                  <BusinessExperienceEditor experiences={business.primary_venue?.experiences ?? []} />
                </div>
                <div className={onboardingStepClass('media')}>
                  <div className="business-form-section-title">
                    <h3>Photos, menus, and videos</h3>
                    <p>Organize media by purpose so Zumers can show the right visual in search and recommendations.</p>
                  </div>
                  <BusinessMediaManager
                    businessMedia={business.media ?? []}
                    venueMedia={business.primary_venue?.media ?? []}
                  />
                </div>
                <div className={onboardingStepClass('hours')}>
                  <div className="business-form-section-title">
                    <h3>Opening hours</h3>
                    <p>Day-wise timings support open-now and late-night discovery.</p>
                  </div>
                  <BusinessOpeningHoursEditor schedule={business.opening_hours_schedule} />
                </div>
                <div className={onboardingStepClass('preview')}>
                  <div className="business-form-section-title">
                    <h3>Preview and publish</h3>
                    <p>Save a draft anytime, or submit when the profile is ready for review.</p>
                  </div>
                  <div className="business-onboarding-preview">
                    <div>
                      <span>Business</span>
                      <strong>{business.business_name}</strong>
                    </div>
                    <div>
                      <span>Category</span>
                      <strong>{business.business_category}</strong>
                    </div>
                    <div>
                      <span>Location</span>
                      <strong>{business.location}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{business.onboarding_status}</strong>
                    </div>
                    <div>
                      <span>Open now</span>
                      <strong>{business.open_now ? 'Open' : 'Closed'}</strong>
                    </div>
                  </div>
                </div>
                <div className="business-onboarding-actions">
                  <button
                    className="business-secondary dark"
                    disabled={activeOnboardingIndex === 0}
                    type="button"
                    onClick={() => goToOnboardingStep(-1)}
                  >
                    Back
                  </button>
                  <button
                    className="business-secondary dark"
                    disabled={activeOnboardingIndex === businessOnboardingSteps.length - 1}
                    type="button"
                    onClick={() => goToOnboardingStep(1)}
                  >
                    Next
                  </button>
                  <button
                    className="business-secondary dark"
                    disabled={busy === 'onboarding-draft'}
                    name="onboarding_status"
                    type="submit"
                    value="draft"
                  >
                    <Save size={18} />
                    {busy === 'onboarding-draft' ? 'Saving draft' : 'Save draft'}
                  </button>
                  <button
                    className="business-primary"
                    disabled={busy === 'onboarding-submitted'}
                    name="onboarding_status"
                    type="submit"
                    value="submitted"
                  >
                    <Save size={18} />
                    {busy === 'onboarding-submitted' ? 'Submitting' : 'Submit onboarding'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </section>
      </main>
    )
  }

  return (
    <main className="business-page">
      <section
        className="business-hero"
        style={{ backgroundImage: `url(${businessHero})` }}
      >
        <div className="business-hero-shade" />
        <header className="business-nav" aria-label="Zumers business navigation">
          <Link className="business-brand" to="/">
            <span>Z</span>
            <strong>Zumers Business</strong>
          </Link>
          <nav>
            <button type="button" onClick={() => openAuth('signup')}>Signup</button>
            <button type="button" onClick={() => openAuth('login')}>Login</button>
            {business ? <Link to={businessPath('/dashboard')}>Dashboard</Link> : null}
          </nav>
        </header>

        <div className="business-hero-content">
          <p className="business-kicker">
            <Store size={18} /> For places, services, travel, and events
          </p>
          <h1>Bring your business into today&apos;s plans.</h1>
          <p>
            Zumers Business helps street food vendors, restaurants, travel
            providers, event hosts, and local services register, onboard, and
            get discovered by users looking for what to do today.
          </p>
          <div className="business-actions">
            <button className="business-primary" type="button" onClick={() => openAuth('signup')}>
              Register business <ArrowRight size={18} />
            </button>
            <button className="business-secondary" type="button" onClick={() => openAuth('login')}>
              Business login
            </button>
          </div>
        </div>
      </section>

      <section className="business-category-strip" aria-label="Business categories">
        {businessTypes.map((item) => (
          <article key={item.title}>
            <item.icon size={22} />
            <div>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="business-section business-onboarding" id="business-onboarding">
        <div className="business-section-copy">
          <p className="business-label">Business onboarding platform</p>
          <h2>Register once, then control what Zumers users see today.</h2>
          <p>
            The business dashboard is where owners complete onboarding, publish
            today&apos;s update, manage discounts, track offer clicks, and review
            booking requests.
          </p>
        </div>
        <div className="business-checklist">
          {onboardingSteps.map((step) => (
            <div key={step}>
              <CheckCircle2 size={22} />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="business-section business-proof-section">
        <div className="business-section-copy">
          <p className="business-label">Successful stories</p>
          <h2>Built for businesses that need today&apos;s attention.</h2>
          <p>
            Zumers Business is designed around practical local discovery:
            fresh updates, live offers, booking intent, and clear visibility
            into what users are clicking.
          </p>
        </div>
        <div className="business-story-grid">
          {successStories.map((story) => (
            <article key={story.name}>
              <span>{story.metric}</span>
              <h3>{story.name}</h3>
              <small>{story.category}</small>
              <p>{story.result}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="business-section business-current-section">
        <div className="business-current-heading">
          <div>
            <p className="business-label">Currently onboarding businesses</p>
            <h2>New places are preparing to go live on Zumers.</h2>
          </div>
          <button className="business-secondary dark" type="button" onClick={() => openAuth('signup')}>
            Start onboarding
          </button>
        </div>
        <div className="business-current-list">
          {onboardingBusinesses.map((item) => (
            <article key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.category}</span>
              </div>
              <small>{item.location}</small>
            </article>
          ))}
        </div>
      </section>

      {authMode ? (
        <div className="business-auth-overlay" role="dialog" aria-modal="true">
          <article className="business-auth-modal">
            <button className="business-auth-close" type="button" onClick={closeAuth} aria-label="Close">
              <X size={22} />
            </button>
            <div className="business-auth-layout">
              <aside className="business-auth-aside">
                <span className="business-auth-mark">Z</span>
                <div>
                  <p className="business-label">Zumers Business</p>
                  <h2>
                    {authMode === 'signup'
                      ? 'Set up your discovery profile.'
                      : 'Manage what users discover today.'}
                  </h2>
                  <p>
                    {authMode === 'signup'
                      ? 'Create a business account, complete your profile, and keep offers ready for nearby user searches.'
                      : 'Open your dashboard to update offers, availability, location details, and customer intent signals.'}
                  </p>
                </div>
                <div className="business-auth-points">
                  <span>Today updates</span>
                  <span>Offers</span>
                  <span>Bookings</span>
                  <span>Discovery tags</span>
                </div>
              </aside>
              <div className="business-auth-panel">
                <div className="business-auth-tabs">
                  <button
                    className={authMode === 'signup' ? 'active' : ''}
                    type="button"
                    onClick={() => openAuth('signup')}
                  >
                    Signup
                  </button>
                  <button
                    className={authMode === 'login' ? 'active' : ''}
                    type="button"
                    onClick={() => openAuth('login')}
                  >
                    Login
                  </button>
                </div>
                <ErrorBanner message={error} />
                {authMode === 'signup' ? (
                  <BusinessSignupForm
                    busy={busy}
                    categories={businessCategories}
                    duplicateMatches={businessDuplicateMatches}
                    onLogin={() => openAuth('login')}
                    onSubmit={signup}
                  />
                ) : (
                  <BusinessLoginForm busy={busy} onSubmit={login} />
                )}
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  )
}

function BusinessSignupForm({
  busy,
  categories,
  duplicateMatches,
  onLogin,
  onSubmit,
}: {
  busy: string | null
  categories: BusinessTaxonomyCategory[]
  duplicateMatches: BusinessDuplicateMatch[]
  onLogin: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="business-form-preview business-auth-form business-signup-form" onSubmit={onSubmit}>
      <div className="business-form-heading">
        <Building2 size={26} />
        <div>
          <p className="business-label">Business signup</p>
          <h2>Create your business account</h2>
        </div>
      </div>
      <label>
        Business name
        <input name="business_name" placeholder="Example: Johri Restaurant" required />
      </label>
      <BusinessCategoryFields categories={categories} initialCategory="" initialSubcategory="" />
      <label>
        Area or city
        <input name="location" placeholder="Example: Rajouri Garden, New Delhi" />
      </label>
      <label>
        Contact phone
        <input name="contact_phone" placeholder="Optional" />
      </label>
      <label>
        Email
        <input name="email" placeholder="owner@example.com" type="email" required />
      </label>
      <label>
        Password
        <input name="password" minLength={8} placeholder="Password" type="password" required />
      </label>
      {duplicateMatches.length ? (
        <div className="business-duplicate-list">
          {duplicateMatches.map((match) => (
            <div key={match.business_id}>
              <strong>{match.business_name}</strong>
              <span>{match.business_category} - {match.location}</span>
              <small>{businessVerificationLabel(match.verification_level)}</small>
            </div>
          ))}
          <button className="business-secondary" type="button" onClick={onLogin}>
            Login to claim
          </button>
        </div>
      ) : null}
      <button className="business-primary" disabled={busy === 'signup'}>
        {busy === 'signup' ? 'Creating account' : 'Continue to dashboard'}
        <ArrowRight size={18} />
      </button>
    </form>
  )
}

function BusinessCategoryFields({
  categories,
  initialCategory,
  initialSubcategory,
}: {
  categories: BusinessTaxonomyCategory[]
  initialCategory: string
  initialSubcategory: string
}) {
  const [categoryValue, setCategoryValue] = useState(initialCategory)
  const [subcategoryValue, setSubcategoryValue] = useState(initialSubcategory)
  const category = categories.find((item) => item.name === categoryValue)
  const subcategories = category?.subcategories ?? []

  return (
    <>
      <label>
        Category
        <select
          name="business_category"
          required
          value={categoryValue}
          onChange={(event) => {
            setCategoryValue(event.target.value)
            setSubcategoryValue('')
          }}
        >
          <option value="" disabled>Select category</option>
          {categoryValue && !categories.some((item) => item.name === categoryValue) ? (
            <option value={categoryValue}>{categoryValue}</option>
          ) : null}
          {categories.map((categoryItem) => (
            <option key={categoryItem.slug} value={categoryItem.name}>
              {categoryItem.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subcategory
        <select
          name="business_subcategory"
          value={subcategoryValue}
          onChange={(event) => setSubcategoryValue(event.target.value)}
        >
          <option value="">Select subcategory</option>
          {subcategoryValue && !subcategories.some((item) => item.name === subcategoryValue) ? (
            <option value={subcategoryValue}>{subcategoryValue}</option>
          ) : null}
          {subcategories.map((subcategory) => (
            <option key={subcategory.slug} value={subcategory.name}>
              {subcategory.name}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

function BusinessTagMultiSelect({
  label,
  name,
  options,
  value,
}: {
  label: string
  name: string
  options: BusinessTaxonomyTag[]
  value: string
}) {
  const [selected, setSelected] = useState(() => parseTagList(value))
  const selectedKeys = new Set(selected.map(normalizeTagValue))
  const unknownSelected = selected.filter(
    (item) => !options.some((option) => normalizeTagValue(option.name) === normalizeTagValue(item)),
  )

  function toggleOption(optionName: string) {
    const optionKey = normalizeTagValue(optionName)
    setSelected((current) => {
      const exists = current.some((item) => normalizeTagValue(item) === optionKey)
      if (exists) {
        return current.filter((item) => normalizeTagValue(item) !== optionKey)
      }
      return [...current, optionName]
    })
  }

  function removeUnknown(tagName: string) {
    const tagKey = normalizeTagValue(tagName)
    setSelected((current) => current.filter((item) => normalizeTagValue(item) !== tagKey))
  }

  return (
    <fieldset className="business-tag-picker">
      <legend>{label}</legend>
      <input name={name} type="hidden" value={selected.join(', ')} />
      <div className="business-tag-options">
        {options.map((option) => (
          <label key={option.slug}>
            <input
              checked={selectedKeys.has(normalizeTagValue(option.name))}
              type="checkbox"
              onChange={() => toggleOption(option.name)}
            />
            <span>{option.name}</span>
          </label>
        ))}
      </div>
      {unknownSelected.length ? (
        <div className="business-tag-legacy" aria-label={`${label} legacy selections`}>
          {unknownSelected.map((tag) => (
            <button key={tag} type="button" onClick={() => removeUnknown(tag)}>
              {tag}
              <X size={13} />
            </button>
          ))}
        </div>
      ) : null}
    </fieldset>
  )
}

function parseTagList(value: string) {
  const seen = new Set<string>()
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => {
      const key = normalizeTagValue(item)
      if (!key || seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
}

function normalizeTagValue(value: string) {
  return value.trim().toLowerCase()
}

function BusinessMediaManager({
  businessMedia,
  venueMedia,
}: {
  businessMedia: BusinessMedia[]
  venueMedia: BusinessMedia[]
}) {
  const [businessItems, setBusinessItems] = useState(() => businessMedia)
  const [venueItems, setVenueItems] = useState(() => venueMedia)

  return (
    <div className="business-media-manager">
      <input
        name="business_media_json"
        type="hidden"
        value={JSON.stringify(normalizeBusinessMediaOrder(businessItems))}
      />
      <input
        name="venue_media_json"
        type="hidden"
        value={JSON.stringify(normalizeBusinessMediaOrder(venueItems))}
      />
      <BusinessMediaBucket
        accept="image/*"
        description="Main image for profile cards and future discovery pages."
        items={businessItems}
        label="Cover photo"
        purpose="cover"
        single
        onChange={setBusinessItems}
      />
      <BusinessMediaBucket
        accept="image/*"
        description="General place photos for profile gallery."
        items={businessItems}
        label="Gallery"
        purpose="gallery"
        onChange={setBusinessItems}
      />
      <BusinessMediaBucket
        accept="image/*"
        description="Dishes, counters, packages, or products users can evaluate visually."
        items={venueItems}
        label="Food or products"
        purpose="food"
        onChange={setVenueItems}
      />
      <BusinessMediaBucket
        accept="image/*,video/*"
        description="Things people can do here, such as games, live music, trips, or workshops."
        items={venueItems}
        label="Activities"
        purpose="activity"
        onChange={setVenueItems}
      />
      <BusinessMediaBucket
        accept="image/*"
        description="Menu, rate card, package list, or ticket details."
        items={venueItems}
        label="Menu or rate card"
        purpose="menu"
        onChange={setVenueItems}
      />
      <BusinessMediaBucket
        accept="video/*"
        description="Short videos for richer recommendations and future reels-style discovery."
        items={venueItems}
        label="Videos"
        purpose="video"
        onChange={setVenueItems}
      />
    </div>
  )
}

function BusinessMediaBucket({
  accept,
  description,
  items,
  label,
  purpose,
  single = false,
  onChange,
}: {
  accept: string
  description: string
  items: BusinessMedia[]
  label: string
  purpose: BusinessMedia['purpose']
  single?: boolean
  onChange: (items: BusinessMedia[]) => void
}) {
  const [progress, setProgress] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const purposeItems = items.filter((item) => item.purpose === purpose)

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    setStatus(null)
    setProgress(0)
    try {
      const uploadedItems: BusinessMedia[] = []
      for (const file of files) {
        const uploaded = await uploadToCloudinary(
          file,
          (uploadProgress) => setProgress(uploadProgress.percent),
          businessApi.signUpload,
        )
        uploadedItems.push({
          ...uploaded,
          purpose,
          display_order: purposeItems.length + uploadedItems.length,
          status: 'active',
        })
      }

      onChange(
        single
          ? [...items.filter((item) => item.purpose !== purpose), uploadedItems[uploadedItems.length - 1]]
          : [...items, ...uploadedItems],
      )
      setStatus(`${uploadedItems.length} media item${uploadedItems.length === 1 ? '' : 's'} added.`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Media upload failed.')
    } finally {
      setProgress(null)
    }
  }

  function remove(publicID: string) {
    onChange(items.filter((item) => item.cloudinary_public_id !== publicID))
  }

  return (
    <fieldset className="business-media-bucket">
      <legend>{label}</legend>
      <p>{description}</p>
      <label className="business-media-upload">
        <ImagePlus size={18} />
        <span>{single && purposeItems.length ? 'Replace' : 'Upload'}</span>
        <input accept={accept} multiple={!single} type="file" onChange={upload} />
      </label>
      {progress !== null ? (
        <div className="upload-progress" aria-label={`${label} upload progress`}>
          <span style={{ width: `${progress}%` }} />
          <strong>{progress}%</strong>
        </div>
      ) : null}
      {status ? <small>{status}</small> : null}
      {purposeItems.length ? (
        <div className="business-media-preview-grid">
          {purposeItems.map((item) => (
            <div className="business-media-preview" key={item.cloudinary_public_id}>
              {item.media_type === 'video' ? (
                <video
                  controls
                  playsInline
                  poster={item.thumbnail_url}
                  src={cloudinaryDeliveryUrl(item.media_type, item.secure_url)}
                />
              ) : (
                <img
                  alt={item.alt_text ?? label}
                  src={cloudinaryDeliveryUrl(item.media_type, item.secure_url)}
                />
              )}
              <button type="button" onClick={() => remove(item.cloudinary_public_id)} aria-label="Remove media">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </fieldset>
  )
}

function normalizeBusinessMediaOrder(media: BusinessMedia[]) {
  const counters = new Map<string, number>()
  return media.map((item) => {
    const displayOrder = counters.get(item.purpose) ?? 0
    counters.set(item.purpose, displayOrder + 1)
    return {
      ...item,
      display_order: displayOrder,
    }
  })
}

function BusinessOpeningHoursEditor({ schedule }: { schedule?: BusinessOpeningHour[] }) {
  const [closedDays, setClosedDays] = useState(() => {
    const initial = new Set<number>()
    for (const item of schedule ?? []) {
      if (item.is_closed) {
        initial.add(item.weekday)
      }
    }
    return initial
  })

  return (
    <div className="business-hours-editor">
      {businessWeekdays.map((day, weekday) => {
        const isClosed = closedDays.has(weekday)
        return (
          <fieldset key={day} className={isClosed ? 'business-hours-day closed' : 'business-hours-day'}>
            <legend>{day}</legend>
            <label className="business-hours-closed">
              <input
                name={`opening_hours_${weekday}_closed`}
                type="checkbox"
                checked={isClosed}
                onChange={(event) => {
                  setClosedDays((current) => {
                    const next = new Set(current)
                    if (event.target.checked) {
                      next.add(weekday)
                    } else {
                      next.delete(weekday)
                    }
                    return next
                  })
                }}
              />
              Closed
            </label>
            <div className="business-hours-interval">
              <label>
                Start timing
                <input
                  aria-label={`${day} start timing`}
                  defaultValue={schedule?.find((item) => item.weekday === weekday && !item.is_closed)?.opens_at ?? ''}
                  disabled={isClosed}
                  name={`opening_hours_${weekday}_opens_at`}
                  type="time"
                />
              </label>
              <label>
                Close timing
                <input
                  aria-label={`${day} close timing`}
                  defaultValue={schedule?.find((item) => item.weekday === weekday && !item.is_closed)?.closes_at ?? ''}
                  disabled={isClosed}
                  name={`opening_hours_${weekday}_closes_at`}
                  type="time"
                />
              </label>
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

function BusinessExperienceEditor({ experiences }: { experiences: BusinessVenueExperience[] }) {
  const rows = Array.from({ length: Math.max(3, experiences.length) }, (_, index) => experiences[index])

  return (
    <div className="business-experience-editor">
      <div className="business-form-section-title">
        <h3>What can people do here?</h3>
        <p>Experiences are the main discovery data Zumers will recommend to users.</p>
      </div>
      {rows.map((experience, index) => (
        <fieldset key={experience?.id ?? index} className="business-experience-card">
          <legend>Experience {index + 1}</legend>
          <label>
            Name
            <input
              name={`experience_${index}_name`}
              defaultValue={experience?.experience_name ?? ''}
              placeholder="Example: Bowling, Rooftop dinner, Momos"
            />
          </label>
          <label>
            Category
            <input
              name={`experience_${index}_category`}
              defaultValue={experience?.category ?? ''}
              placeholder="Example: Gaming, Food, Live music"
            />
          </label>
          <label>
            Description
            <textarea
              name={`experience_${index}_description`}
              defaultValue={experience?.description ?? ''}
              placeholder="Short details users should know before choosing this."
            />
          </label>
          <label>
            Tags
            <input
              name={`experience_${index}_tags`}
              defaultValue={experience?.tags ?? ''}
              placeholder="quick bite, friends hangout, late night"
            />
          </label>
          <label>
            Starting price
            <input
              name={`experience_${index}_starting_price`}
              defaultValue={experience?.starting_price ?? ''}
              inputMode="decimal"
              min="0"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Avg. per person
            <input
              name={`experience_${index}_average_price_per_person`}
              defaultValue={experience?.average_price_per_person ?? ''}
              inputMode="decimal"
              min="0"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Duration
            <input
              name={`experience_${index}_typical_duration_minutes`}
              defaultValue={experience?.typical_duration_minutes ?? ''}
              inputMode="numeric"
              min="1"
              placeholder="Minutes"
              type="number"
            />
          </label>
          <label>
            Indoor/outdoor
            <select name={`experience_${index}_indoor_outdoor`} defaultValue={experience?.indoor_outdoor ?? ''}>
              <option value="">Select</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label>
            Min group
            <input
              name={`experience_${index}_min_group_size`}
              defaultValue={experience?.min_group_size ?? ''}
              inputMode="numeric"
              min="1"
              type="number"
            />
          </label>
          <label>
            Ideal group
            <input
              name={`experience_${index}_ideal_group_size`}
              defaultValue={experience?.ideal_group_size ?? ''}
              inputMode="numeric"
              min="1"
              type="number"
            />
          </label>
          <label>
            Max group
            <input
              name={`experience_${index}_max_group_size`}
              defaultValue={experience?.max_group_size ?? ''}
              inputMode="numeric"
              min="1"
              type="number"
            />
          </label>
          <div className="business-experience-toggles">
            <label>
              <input
                name={`experience_${index}_booking_required`}
                type="checkbox"
                defaultChecked={experience?.booking_required ?? false}
              />
              Booking required
            </label>
            <label>
              <input
                name={`experience_${index}_walk_in_available`}
                type="checkbox"
                defaultChecked={experience?.walk_in_available ?? true}
              />
              Walk-in available
            </label>
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function BusinessCurrentLocationPicker({
  initialValue,
  required = false,
}: {
  initialValue?: Partial<BusinessLocationValue>
  required?: boolean
}) {
  const [value, setValue] = useState<BusinessLocationValue>({
    location: initialValue?.location ?? '',
    address: initialValue?.address ?? '',
    city: initialValue?.city ?? '',
    area: initialValue?.area ?? '',
    postal_code: initialValue?.postal_code ?? '',
    google_place_id: initialValue?.google_place_id ?? '',
    state: initialValue?.state ?? '',
    country: initialValue?.country ?? '',
    district: initialValue?.district ?? '',
    landmark: initialValue?.landmark ?? '',
    latitude: initialValue?.latitude ?? '',
    longitude: initialValue?.longitude ?? '',
    location_accuracy_meters: initialValue?.location_accuracy_meters ?? '',
  })
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function updateField(field: keyof BusinessLocationValue, fieldValue: string) {
    setValue((current) => ({
      ...current,
      [field]: fieldValue,
    }))
  }

  async function useCurrentLocation() {
    setStatus(null)

    if (!navigator.geolocation) {
      setStatus('Current location is not supported by this browser.')
      return
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setStatus('Google Maps API key is missing.')
      return
    }

    setLoading(true)
    try {
      const position = await getBrowserPosition()
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      const accuracy = position.coords.accuracy
      const resolved = await reverseGeocode(latitude, longitude, apiKey)

      setValue({
        location: resolved.location,
        address: resolved.address,
        city: resolved.city,
        area: resolved.area,
        postal_code: resolved.postal_code,
        google_place_id: resolved.google_place_id,
        state: resolved.state,
        country: resolved.country,
        district: resolved.district,
        landmark: resolved.landmark,
        latitude: latitude.toFixed(7),
        longitude: longitude.toFixed(7),
        location_accuracy_meters: Number.isFinite(accuracy) ? accuracy.toFixed(1) : '',
      })
      setStatus('Current location selected.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not get current location.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="business-location-picker">
      <div className="business-location-control">
        <MapPin size={18} />
        <input
          name="location"
          placeholder="Use current location"
          required={required}
          onChange={(event) => updateField('location', event.target.value)}
          value={value.location}
        />
        <button disabled={loading} type="button" onClick={useCurrentLocation}>
          <LocateFixed size={17} />
          {loading ? 'Locating' : 'Use current'}
        </button>
      </div>
      {value.address ? (
        <div className="business-location-preview">
          <label>
            Full address
            <textarea
              name="address"
              onChange={(event) => updateField('address', event.target.value)}
              value={value.address}
            />
          </label>
          <div className="business-location-preview-grid">
            <label>
              City
              <input
                name="city"
                onChange={(event) => updateField('city', event.target.value)}
                value={value.city}
              />
            </label>
            <label>
              Area
              <input
                name="area"
                onChange={(event) => updateField('area', event.target.value)}
                value={value.area}
              />
            </label>
            <label>
              Pincode
              <input
                name="postal_code"
                inputMode="numeric"
                onChange={(event) => updateField('postal_code', event.target.value)}
                value={value.postal_code}
              />
            </label>
            <label>
              Landmark
              <input
                name="landmark"
                onChange={(event) => updateField('landmark', event.target.value)}
                value={value.landmark}
              />
            </label>
          </div>
        </div>
      ) : null}
      {status ? <small className="business-location-status">{status}</small> : null}
      {!value.address ? <input name="address" type="hidden" value="" /> : null}
      {!value.address ? <input name="city" type="hidden" value="" /> : null}
      {!value.address ? <input name="area" type="hidden" value="" /> : null}
      {!value.address ? <input name="postal_code" type="hidden" value="" /> : null}
      {!value.address ? <input name="landmark" type="hidden" value="" /> : null}
      <input name="google_place_id" type="hidden" value={value.google_place_id} />
      <input name="state" type="hidden" value={value.state} />
      <input name="country" type="hidden" value={value.country} />
      <input name="district" type="hidden" value={value.district} />
      <input name="latitude" type="hidden" value={value.latitude} />
      <input name="longitude" type="hidden" value={value.longitude} />
      <input name="location_accuracy_meters" type="hidden" value={value.location_accuracy_meters} />
    </div>
  )
}

function getBrowserPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    })
  }).catch((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      throw new Error('Location permission was denied.')
    }
    if (err.code === err.POSITION_UNAVAILABLE) {
      throw new Error('Current location is unavailable.')
    }
    if (err.code === err.TIMEOUT) {
      throw new Error('Location request timed out.')
    }
    throw new Error('Could not get current location.')
  })
}

async function reverseGeocode(latitude: number, longitude: number, apiKey: string) {
  const googleMaps = await loadGoogleMaps(apiKey)
  const geocoder = new googleMaps.maps.Geocoder()

  const results = await new Promise<GoogleGeocodeResult[]>((resolve, reject) => {
    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (geocodeResults, status) => {
      if (status === googleMaps.maps.GeocoderStatus.OK && geocodeResults?.length) {
        resolve(geocodeResults)
        return
      }

      reject(new Error('No address found for current location.'))
    })
  })

  return locationValueFromGeocode(results[0])
}

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) {
    return Promise.resolve(window.google)
  }
  if (googleMapsLoader) {
    return googleMapsLoader
  }

  googleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const query = new URLSearchParams({
      key: apiKey,
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${query.toString()}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google)
        return
      }
      reject(new Error('Google Maps could not be loaded.'))
    }
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'))
    document.head.appendChild(script)
  })

  return googleMapsLoader
}

function locationValueFromGeocode(result: GoogleGeocodeResult): BusinessLocationValue {
  const components = result.address_components ?? []
  const area =
    findAddressComponent(components, 'sublocality_level_1') ||
    findAddressComponent(components, 'sublocality') ||
    findAddressComponent(components, 'neighborhood') ||
    findAddressComponent(components, 'locality')
  const city =
    findAddressComponent(components, 'locality') ||
    findAddressComponent(components, 'administrative_area_level_3') ||
    findAddressComponent(components, 'administrative_area_level_2')
  const postalCode = findAddressComponent(components, 'postal_code')
  const state = findAddressComponent(components, 'administrative_area_level_1')
  const district =
    findAddressComponent(components, 'administrative_area_level_2') ||
    findAddressComponent(components, 'administrative_area_level_3')
  const country = findAddressComponent(components, 'country')
  const landmark =
    findAddressComponent(components, 'premise') ||
    findAddressComponent(components, 'point_of_interest') ||
    findAddressComponent(components, 'establishment')
  const location = [area, city].filter(Boolean).join(', ') || result.formatted_address || ''

  return {
    location,
    address: result.formatted_address ?? location,
    city,
    area,
    postal_code: postalCode,
    google_place_id: result.place_id ?? '',
    state,
    country,
    district,
    landmark,
    latitude: '',
    longitude: '',
    location_accuracy_meters: '',
  }
}

function findAddressComponent(components: GoogleGeocodeAddressComponent[], type: string) {
  return components.find((component) => component.types.includes(type))?.long_name ?? ''
}

function formatDashboardDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function businessVerificationLabel(level: string) {
  return level.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function businessLocationValue(business: BusinessAccount): BusinessLocationValue {
  return {
    location: business.location,
    address: business.address ?? '',
    city: business.city ?? '',
    area: business.area ?? '',
    postal_code: business.postal_code ?? '',
    google_place_id: business.google_place_id ?? '',
    state: business.state ?? '',
    country: business.country ?? '',
    district: business.district ?? '',
    landmark: business.landmark ?? '',
    latitude: business.latitude === undefined ? '' : String(business.latitude),
    longitude: business.longitude === undefined ? '' : String(business.longitude),
    location_accuracy_meters: business.location_accuracy_meters === undefined
      ? ''
      : String(business.location_accuracy_meters),
  }
}

function BusinessLoginForm({
  busy,
  onSubmit,
}: {
  busy: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="business-form-preview business-auth-form business-login-form" onSubmit={onSubmit}>
      <div className="business-form-heading">
        <BadgeCheck size={26} />
        <div>
          <p className="business-label">Business login</p>
          <h2>Open your business dashboard</h2>
        </div>
      </div>
      <label>
        Email
        <input name="email" placeholder="owner@example.com" type="email" required />
      </label>
      <label>
        Password
        <input name="password" placeholder="Password" type="password" required />
      </label>
      <div className="business-login-note">
        <Clock3 size={18} />
        <span>Manage today&apos;s update, offers, bookings, and onboarding.</span>
      </div>
      <button className="business-secondary dark" disabled={busy === 'login'}>
        {busy === 'login' ? 'Logging in' : 'Login to dashboard'}
      </button>
    </form>
  )
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (!text) return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

function optionalPriceRange(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (
    text === 'budget' ||
    text === 'moderate' ||
    text === 'premium' ||
    text === 'luxury'
  ) {
    return text
  }

  return undefined
}

function onboardingSubmitStatus(event: FormEvent<HTMLFormElement>) {
  const submitter = (event.nativeEvent as SubmitEvent).submitter
  if (
    submitter instanceof HTMLButtonElement &&
    submitter.name === 'onboarding_status' &&
    submitter.value === 'draft'
  ) {
    return 'draft'
  }

  return 'submitted'
}

function businessProfileCompleteness(business: BusinessAccount) {
  const checks = [
    business.business_name,
    business.business_category,
    business.business_subcategory,
    business.location,
    business.address,
    business.city,
    business.area,
    business.postal_code,
    business.contact_phone || business.whatsapp_number,
    business.price_range,
    business.description,
    business.offerings,
    business.mood_tags,
    business.service_tags,
    business.best_for,
    business.facility_tags,
    business.opening_hours,
    business.media?.some((item) => item.purpose === 'cover'),
    business.primary_venue?.media?.length,
  ]
  const completed = checks.filter((value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    return String(value ?? '').trim()
  }).length

  return Math.round((completed / checks.length) * 100)
}

function businessProfileCompletionTasks(business: BusinessAccount) {
  const tasks = [
    { done: Boolean(business.business_subcategory), text: 'Choose a precise subcategory.' },
    { done: Boolean(business.address && business.city && business.area), text: 'Complete your business address.' },
    { done: Boolean(business.contact_phone || business.whatsapp_number), text: 'Add a public customer contact.' },
    { done: Boolean(business.opening_hours), text: 'Set structured opening hours.' },
    { done: Boolean(business.price_range), text: 'Add budget or pricing guidance.' },
    { done: Boolean(business.description), text: 'Write a clear business description.' },
    { done: Boolean(business.primary_venue?.experiences?.length), text: 'Add at least one experience users can do.' },
    { done: Boolean(business.media?.some((item) => item.purpose === 'cover')), text: 'Upload a strong cover image.' },
  ]

  return tasks.filter((task) => !task.done).slice(0, 3).map((task) => task.text)
}

function businessOpeningHoursFromForm(form: FormData): BusinessOpeningHour[] {
  const schedule: BusinessOpeningHour[] = []
  for (let weekday = 0; weekday < businessWeekdays.length; weekday += 1) {
    if (form.get(`opening_hours_${weekday}_closed`) === 'on') {
      schedule.push({
        weekday,
        interval_order: 1,
        is_closed: true,
      })
      continue
    }

    const opensAt = String(form.get(`opening_hours_${weekday}_opens_at`) ?? '').trim()
    const closesAt = String(form.get(`opening_hours_${weekday}_closes_at`) ?? '').trim()
    if (!opensAt && !closesAt) {
      continue
    }
    schedule.push({
      weekday,
      interval_order: 1,
      is_closed: false,
      opens_at: opensAt,
      closes_at: closesAt,
    })
  }

  return schedule
}

function formatBusinessOpeningHours(schedule: BusinessOpeningHour[]) {
  const byDay = new Map<number, BusinessOpeningHour[]>()
  for (const item of schedule) {
    byDay.set(item.weekday, [...(byDay.get(item.weekday) ?? []), item])
  }

  return businessWeekdays
    .map((day, weekday) => {
      const daySchedule = byDay.get(weekday) ?? []
      if (!daySchedule.length) return ''
      if (daySchedule.some((item) => item.is_closed)) return `${day}: Closed`
      const intervals = daySchedule
        .filter((item) => item.opens_at && item.closes_at)
        .sort((a, b) => a.interval_order - b.interval_order)
        .map((item) => `${item.opens_at}-${item.closes_at}`)
        .join(', ')
      return intervals ? `${day}: ${intervals}` : ''
    })
    .filter(Boolean)
    .join('; ')
}

function businessVenueExperiencesFromForm(form: FormData): BusinessVenueExperience[] {
  const experiences: BusinessVenueExperience[] = []
  for (let index = 0; index < 12; index += 1) {
    const experienceName = String(form.get(`experience_${index}_name`) ?? '').trim()
    const description = String(form.get(`experience_${index}_description`) ?? '').trim()
    const category = String(form.get(`experience_${index}_category`) ?? '').trim()
    if (!experienceName && !description && !category) {
      continue
    }

    experiences.push({
      experience_name: experienceName,
      description,
      category,
      tags: String(form.get(`experience_${index}_tags`) ?? '').trim(),
      starting_price: optionalNumber(form.get(`experience_${index}_starting_price`)),
      average_price_per_person: optionalNumber(form.get(`experience_${index}_average_price_per_person`)),
      typical_duration_minutes: optionalInteger(form.get(`experience_${index}_typical_duration_minutes`)),
      min_group_size: optionalInteger(form.get(`experience_${index}_min_group_size`)),
      ideal_group_size: optionalInteger(form.get(`experience_${index}_ideal_group_size`)),
      max_group_size: optionalInteger(form.get(`experience_${index}_max_group_size`)),
      indoor_outdoor: optionalIndoorOutdoor(form.get(`experience_${index}_indoor_outdoor`)),
      booking_required: form.get(`experience_${index}_booking_required`) === 'on',
      walk_in_available: form.get(`experience_${index}_walk_in_available`) === 'on',
      status: 'active',
      display_order: experiences.length + 1,
    })
  }

  return experiences
}

function businessMediaFromForm(form: FormData, fieldName: string): BusinessMedia[] {
  const value = String(form.get(fieldName) ?? '').trim()
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is BusinessMedia => isBusinessMedia(item))
      .map((item, index) => ({
        ...item,
        display_order: Number.isFinite(item.display_order) && item.display_order >= 0
          ? item.display_order
          : index,
      }))
  } catch {
    return []
  }
}

function isBusinessMedia(value: unknown): value is BusinessMedia {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<BusinessMedia>
  const validType = item.media_type === 'image' || item.media_type === 'video'
  const validPurpose =
    item.purpose === 'cover' ||
    item.purpose === 'gallery' ||
    item.purpose === 'food' ||
    item.purpose === 'activity' ||
    item.purpose === 'menu' ||
    item.purpose === 'video'

  return Boolean(
    validType &&
      validPurpose &&
      item.cloudinary_public_id &&
      item.secure_url,
  )
}

function optionalInteger(value: FormDataEntryValue | null) {
  const parsed = optionalNumber(value)
  if (parsed === undefined) return undefined
  const integer = Math.trunc(parsed)
  return integer > 0 ? integer : undefined
}

function optionalIndoorOutdoor(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (text === 'indoor' || text === 'outdoor' || text === 'both') {
    return text
  }

  return undefined
}
