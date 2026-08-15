import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ForkKnife,
  LogOut,
  MapPin,
  Save,
  Store,
  Utensils,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner } from '../components/ErrorBanner'
import businessHero from '../assets/zumers-business-hero.png'
import { businessApi } from '../lib/api'
import type { BusinessAccount } from '../lib/types'

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

export function BusinessPage() {
  const [business, setBusiness] = useState<BusinessAccount | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    businessApi.me().then(setBusiness).catch(() => undefined)
  }, [])

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
      setSuccess('Business account created. Complete onboarding details below.')
      window.location.hash = 'business-dashboard'
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
      setSuccess('Logged in. Continue your business onboarding.')
      window.location.hash = 'business-dashboard'
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

  function logout() {
    businessApi.logout()
    setBusiness(null)
    setSuccess('Business session ended.')
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
            <a href="#business-onboarding">Onboarding</a>
            <a href="#business-signup">Signup</a>
            <a href="#business-login">Login</a>
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
            <a className="business-primary" href="#business-signup">
              Register business <ArrowRight size={18} />
            </a>
            <a className="business-secondary" href="#business-login">
              Business login
            </a>
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
          <p className="business-label">Onboarding platform</p>
          <h2>Register once, complete the details that help people choose you.</h2>
          <p>
            After signup, businesses can log in and complete a structured
            onboarding form. These details can power Zumers recommendations,
            nearby discovery, reels, posts, and visit decisions for users.
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

      <section className="business-section business-access-grid">
        <article className="business-form-card" id="business-signup">
          <div className="business-form-heading">
            <Building2 size={26} />
            <div>
              <p className="business-label">Business signup</p>
              <h2>Create your business account</h2>
            </div>
          </div>
          <form className="business-form-preview" onSubmit={signup}>
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
              {busy === 'signup' ? 'Creating account' : 'Continue onboarding'}
              <ArrowRight size={18} />
            </button>
          </form>
        </article>

        <article className="business-form-card business-login-card" id="business-login">
          <div className="business-form-heading">
            <BadgeCheck size={26} />
            <div>
              <p className="business-label">Business login</p>
              <h2>Return to your onboarding</h2>
            </div>
          </div>
          <form className="business-form-preview" onSubmit={login}>
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
              <span>Complete drafts, update details, and manage visibility.</span>
            </div>
            <button className="business-secondary dark" disabled={busy === 'login'}>
              {busy === 'login' ? 'Logging in' : 'Login to dashboard'}
            </button>
          </form>
        </article>
      </section>

      <section className="business-section business-dashboard" id="business-dashboard">
        <div className="business-dashboard-heading">
          <div>
            <p className="business-label">Business dashboard</p>
            <h2>{business ? business.business_name : 'Login to complete onboarding'}</h2>
          </div>
          {business ? (
            <button className="business-secondary dark" type="button" onClick={logout}>
              <LogOut size={18} /> Logout
            </button>
          ) : null}
        </div>
        <ErrorBanner message={error} />
        {success ? <div className="business-success">{success}</div> : null}
        {business ? (
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
        ) : (
          <div className="business-empty-dashboard">
            Create an account or log in above to open the onboarding form.
          </div>
        )}
      </section>
    </main>
  )
}
