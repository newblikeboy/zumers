import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ForkKnife,
  MapPin,
  Store,
  Utensils,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import businessHero from '../assets/zumers-business-hero.png'

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
          <form className="business-form-preview">
            <label>
              Business name
              <input placeholder="Example: Sharma Street Bites" />
            </label>
            <label>
              Business category
              <select defaultValue="">
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
                <input placeholder="City, area, landmark" />
              </span>
            </label>
            <button className="business-primary" type="button">
              Continue onboarding <ArrowRight size={18} />
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
          <form className="business-form-preview">
            <label>
              Email or phone
              <input placeholder="owner@example.com" />
            </label>
            <label>
              Password
              <input placeholder="Password" type="password" />
            </label>
            <div className="business-login-note">
              <Clock3 size={18} />
              <span>Complete drafts, update details, and manage visibility.</span>
            </div>
            <button className="business-secondary dark" type="button">
              Login to dashboard
            </button>
          </form>
        </article>
      </section>
    </main>
  )
}
