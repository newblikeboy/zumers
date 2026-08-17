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
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ErrorBanner } from '../components/ErrorBanner'
import businessHero from '../assets/zumers-business-hero.png'
import { businessApi } from '../lib/api'
import { businessPath } from '../lib/businessRoutes'
import type { BusinessAccount, BusinessDashboard } from '../lib/types'

const businessTypes = [
  { icon: Utensils, title: 'Street food', text: 'Food carts, local stalls, snacks, and late-night favorites.' },
  { icon: ForkKnife, title: 'Restaurants', text: 'Cafes, family restaurants, premium dining, and hidden gems.' },
  { icon: Bus, title: 'Travel', text: 'Tours, buses, stays, local rides, and weekend trip operators.' },
  { icon: CalendarDays, title: 'Events', text: 'Workshops, shows, meetups, pop-ups, and seasonal experiences.' },
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

const businessDashboardSections = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'today', label: 'Today update', icon: Megaphone },
  { id: 'offers', label: 'Offers', icon: Percent },
  { id: 'bookings', label: 'Bookings', icon: Ticket },
  { id: 'profile', label: 'Business profile', icon: Building2 },
] satisfies Array<{ id: BusinessDashboardSection; label: string; icon: typeof BarChart3 }>

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
    const form = new FormData(event.currentTarget)
    try {
      const response = await businessApi.signup({
        business_name: String(form.get('business_name')),
        business_category: String(form.get('business_category')),
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
    setBusy('onboarding')
    setError(null)
    setSuccess(null)
    const form = new FormData(event.currentTarget)
    try {
      const updated = await businessApi.update({
        business_name: String(form.get('business_name')),
        business_category: String(form.get('business_category')),
        business_subcategory: String(form.get('business_subcategory')),
        location: String(form.get('location')),
        address: String(form.get('address')),
        city: String(form.get('city')),
        area: String(form.get('area')),
        latitude: optionalNumber(form.get('latitude')),
        longitude: optionalNumber(form.get('longitude')),
        service_radius_km: optionalNumber(form.get('service_radius_km')),
        price_range: optionalPriceRange(form.get('price_range')),
        mood_tags: String(form.get('mood_tags')),
        service_tags: String(form.get('service_tags')),
        best_for: String(form.get('best_for')),
        website_url: String(form.get('website_url')),
        whatsapp_number: String(form.get('whatsapp_number')),
        contact_phone: String(form.get('contact_phone')),
        description: String(form.get('description')),
        offerings: String(form.get('offerings')),
        opening_hours: String(form.get('opening_hours')),
        onboarding_status: 'submitted',
      })
      setBusiness(updated)
      setSuccess('Business onboarding submitted.')
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

  function logout() {
    businessApi.logout()
    setBusiness(null)
    navigate(businessPath())
  }

  function openAuth(modeToOpen: BusinessAuthMode) {
    setError(null)
    setSuccess(null)
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
    ]

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
            {businessDashboardSections.map((item) => {
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
            <Link className="business-secondary dark" to={businessPath()}>
              View landing
            </Link>
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
            <section className="business-control-grid business-control-grid-single">
              <article className="business-control-panel">
                <div className="business-panel-heading">
                  <Percent size={24} />
                  <div>
                    <p className="business-label">Live offer</p>
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
              <form className="business-form-preview business-onboarding-form" onSubmit={saveOnboarding}>
              <div className="business-form-section-title">
                <h3>Business identity</h3>
                <p>Core details users and the discovery engine use to understand the business.</p>
              </div>
              <label>
                Business name
                <input name="business_name" defaultValue={business.business_name} required />
              </label>
              <label>
                Category
                <input name="business_category" defaultValue={business.business_category} required />
              </label>
              <label>
                Subcategory
                <input
                  name="business_subcategory"
                  defaultValue={business.business_subcategory ?? ''}
                  placeholder="Example: North Indian, momo stall, weekend tours"
                />
              </label>
              <label>
                Location summary
                <input name="location" defaultValue={business.location} required />
              </label>
              <div className="business-form-section-title">
                <h3>Location intelligence</h3>
                <p>Structured place data for nearby search, maps, and future directions tracking.</p>
              </div>
              <label>
                Address
                <textarea
                  name="address"
                  defaultValue={business.address ?? ''}
                  placeholder="Full address users can follow before opening maps."
                />
              </label>
              <label>
                City
                <input name="city" defaultValue={business.city ?? ''} placeholder="Example: New Delhi" />
              </label>
              <label>
                Area
                <input name="area" defaultValue={business.area ?? ''} placeholder="Example: Rajouri Garden" />
              </label>
              <label>
                Latitude
                <input
                  name="latitude"
                  defaultValue={business.latitude ?? ''}
                  inputMode="decimal"
                  placeholder="Example: 28.6467"
                  step="any"
                  type="number"
                />
              </label>
              <label>
                Longitude
                <input
                  name="longitude"
                  defaultValue={business.longitude ?? ''}
                  inputMode="decimal"
                  placeholder="Example: 77.1200"
                  step="any"
                  type="number"
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
              <div className="business-form-section-title">
                <h3>Discovery content</h3>
                <p>Offers, mood tags, and best-for signals that connect the business to user intent.</p>
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
              <label>
                Mood tags
                <textarea
                  name="mood_tags"
                  defaultValue={business.mood_tags ?? ''}
                  placeholder="hungry, date plan, friends hangout, family dinner, late night"
                />
              </label>
              <label>
                Service tags
                <textarea
                  name="service_tags"
                  defaultValue={business.service_tags ?? ''}
                  placeholder="north indian, momos, buffet, live music, weekend trip"
                />
              </label>
              <label>
                Best for
                <textarea
                  name="best_for"
                  defaultValue={business.best_for ?? ''}
                  placeholder="friends, family, couples, office groups, solo visitors"
                />
              </label>
              <label>
                Opening hours
                <input
                  name="opening_hours"
                  defaultValue={business.opening_hours ?? ''}
                  placeholder="Example: Mon-Sun, 11 AM - 11 PM"
                />
              </label>
              <button className="business-primary" disabled={busy === 'onboarding'}>
                <Save size={18} />
                {busy === 'onboarding' ? 'Saving onboarding' : 'Submit onboarding'}
              </button>
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
                  <BusinessSignupForm busy={busy} onSubmit={signup} />
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
  onSubmit,
}: {
  busy: string | null
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
      <label>
        Business category
        <select name="business_category" defaultValue="" required>
          <option value="" disabled>Select category</option>
          <option>Street food</option>
          <option>Restaurant or cafe</option>
          <option>Travel or transport</option>
          <option>Event or experience</option>
          <option>Other local service</option>
        </select>
      </label>
      <label>
        Location
        <span className="business-input-icon">
          <MapPin size={18} />
          <input name="location" placeholder="City, area, landmark" required />
        </span>
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
      <button className="business-primary" disabled={busy === 'signup'}>
        {busy === 'signup' ? 'Creating account' : 'Continue to dashboard'}
        <ArrowRight size={18} />
      </button>
    </form>
  )
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
