import {
  CalendarCheck,
  CheckCircle2,
  Compass,
  MessageCircle,
  PlayCircle,
  Sparkles,
  Users,
  Vote,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import heroImage from '../assets/zumers-landing-hero.png'
import { businessUrl } from '../lib/businessRoutes'

const moments = [
  {
    icon: Compass,
    title: 'Find the move',
    text: 'Search mood, budget, time, group, or food.',
  },
  {
    icon: Vote,
    title: 'Share the card',
    text: 'Send one option to a friend or group.',
  },
  {
    icon: CalendarCheck,
    title: 'Go',
    text: 'Book, save, vote, or move to chat.',
  },
]

const signals = [
  'Momos',
  'Date',
  'Tonight',
  'Friends',
  'Under 500',
  'Open now',
]

export function LandingPage() {
  return (
    <main className="landing-page">
      <section
        className="landing-hero"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="landing-hero-shade" />
        <header className="landing-nav" aria-label="Zumers public navigation">
          <Link className="landing-brand" to="/">
            <span className="landing-brand-mark">Z</span>
            <span>Zumers</span>
          </Link>
          <nav>
            <a href="#how-it-works">How it works</a>
            <a href={businessUrl()}>Business</a>
            <a href="#why-zumers">Why Zumers</a>
            <Link to="/login">Log in</Link>
            <Link className="landing-nav-cta" to="/signup">
              Join
            </Link>
          </nav>
        </header>

        <div className="landing-hero-content">
          <p className="landing-kicker">
            <Sparkles size={18} /> Find the move
          </p>
          <h1>Zumers</h1>
          <p className="landing-tagline">What now?</p>
          <p className="landing-copy">
            Search nearby plans by mood, people, time, and budget.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" to="/signup">
              Start
            </Link>
            <Link className="landing-secondary" to="/login">
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-signal-band" aria-label="Zumers activity signals">
        {signals.map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </section>

      <section className="landing-section landing-two-column" id="how-it-works">
        <div>
          <p className="landing-section-label">How it works</p>
          <h2>Search. Pick. Go.</h2>
          <p>
            One engine for nearby things to do.
          </p>
        </div>
        <div className="landing-flow">
          {moments.map((item) => (
            <article className="landing-flow-item" key={item.title}>
              <span>
                <item.icon size={24} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-product-panel" id="why-zumers">
        <div className="landing-phone" aria-hidden="true">
          <div className="landing-phone-top">
            <span>Zumers</span>
            <Users size={20} />
          </div>
          <div className="landing-composer">
            <span>momos near me</span>
            <button>Go</button>
          </div>
          <div className="landing-plan-card">
            <div>
              <strong>Rooftop dinner or late show?</strong>
              <small>4 friends voting</small>
            </div>
            <div className="landing-votes">
              <span style={{ width: '74%' }} />
            </div>
          </div>
          <div className="landing-chat-preview">
            <MessageCircle size={18} />
            <span>Perfect for the group</span>
          </div>
          <div className="landing-reel-preview">
            <PlayCircle size={34} />
          </div>
        </div>
        <div className="landing-benefits">
          <p className="landing-section-label">Why Zumers</p>
          <h2>Built for the moment before you leave.</h2>
          <ul>
            <li>
              <CheckCircle2 size={20} />
              Search understands intent, not just business names.
            </li>
            <li>
              <CheckCircle2 size={20} />
              Every result is shareable and votable.
            </li>
            <li>
              <CheckCircle2 size={20} />
              Booking, save, and chat stay one tap away.
            </li>
          </ul>
          <Link className="landing-primary landing-inline-cta" to="/signup">
            Try Zumers
          </Link>
        </div>
      </section>
    </main>
  )
}

