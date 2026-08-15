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

type BusinessAuthMode = 'signup' | 'login'
type BusinessPageMode = 'landing' | 'dashboard'

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
      navigate('/business/dashboard')
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
      navigate('/business/dashboard')
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
        location: String(form.get('location')),
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
    navigate('/business')
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
      navigate('/business', { replace: true })
    }
  }

  if (mode === 'dashboard' && !checkedSession) {
    return <div className="boot-screen">Loading business dashboard</div>
  }

  if (mode === 'dashboard' && checkedSession && !business) {
    return <Navigate to="/business" replace />
  }

  if (mode === 'dashboard' && business) {
    const dashboardStats = [
      { icon: BarChart3, label: 'Offer clicks', value: dashboard?.offer_clicks ?? 0, hint: 'Today' },
      { icon: Users, label: 'Profile visits', value: dashboard?.profile_visits ?? 0, hint: 'Last 24 hours' },
      { icon: Ticket, label: 'Bookings', value: dashboard?.bookings.length ?? 0, hint: 'Pending' },
      { icon: BadgeCheck, label: 'Saves', value: dashboard?.saves ?? 0, hint: 'This week' },
    ]

    return (
      <main className="business-dashboard-shell">
        <aside className="business-dashboard-sidebar">
          <Link className="business-dashboard-brand" to="/business">
            <span>Z</span>
            <strong>Zumers Business</strong>
          </Link>
          <nav>
            <a href="#today">Today</a>
            <a href="#offers">Offers</a>
            <a href="#bookings">Bookings</a>
            <a href="#onboarding">Onboarding</a>
          </nav>
          <button type="button" onClick={logout}>
            <LogOut size={18} /> Logout
          </button>
        </aside>

        <section className="business-dashboard-main">
          <header className="business-dashboard-top">
            <div>
              <p className="business-label">Business dashboard</p>
              <h1>{business.business_name}</h1>
              <span>{business.business_category} - {business.location}</span>
            </div>
            <Link className="business-secondary dark" to="/business">
              View landing
            </Link>
          </header>

          <ErrorBanner message={error} />
          {success ? <div className="business-success">{success}</div> : null}

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

          <section className="business-control-grid">
            <article className="business-control-panel" id="today">
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

            <article className="business-control-panel" id="offers">
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

          <section className="business-control-grid">
            <article className="business-control-panel" id="bookings">
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

          <section className="business-control-panel" id="onboarding">
            <div className="business-panel-heading">
              <Building2 size={24} />
              <div>
                <p className="business-label">Onboarding</p>
                <h2>Business details</h2>
              </div>
            </div>
            <form className="business-form-preview business-onboarding-form" onSubmit={saveOnboarding}>
              <label>
                Business name
                <input name="business_name" defaultValue={business.business_name} required />
              </label>
              <label>
                Category
                <input name="business_category" defaultValue={business.business_category} required />
              </label>
              <label>
                Location
                <input name="location" defaultValue={business.location} required />
              </label>
              <label>
                Contact phone
                <input name="contact_phone" defaultValue={business.contact_phone ?? ''} />
              </label>
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
            {business ? <Link to="/business/dashboard">Dashboard</Link> : null}
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

      {authMode ? (
        <div className="business-auth-overlay" role="dialog" aria-modal="true">
          <article className="business-auth-modal">
            <button className="business-auth-close" type="button" onClick={closeAuth} aria-label="Close">
              <X size={22} />
            </button>
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
    <form className="business-form-preview" onSubmit={onSubmit}>
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
    <form className="business-form-preview" onSubmit={onSubmit}>
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
