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

const moments = [
  {
    icon: Compass,
    title: 'Find the move',
    text: 'See nearby ideas, friend plans, quick reels, and posts built around what people are actually doing.',
  },
  {
    icon: Vote,
    title: 'Decide together',
    text: 'Turn group indecision into simple choices, reactions, comments, and conversations.',
  },
  {
    icon: CalendarCheck,
    title: 'Make today happen',
    text: 'Keep plans social, visible, and easy to act on without jumping between apps.',
  },
]

const signals = [
  'Weekend plans',
  'Friend votes',
  'Local ideas',
  'Reels from people',
  'Chat decisions',
  'Shared moments',
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
            <a href="#why-zumers">Why Zumers</a>
            <Link to="/login">Log in</Link>
            <Link className="landing-nav-cta" to="/signup">
              Join
            </Link>
          </nav>
        </header>

        <div className="landing-hero-content">
          <p className="landing-kicker">
            <Sparkles size={18} /> Social decisions for real life
          </p>
          <h1>Zumers</h1>
          <p className="landing-tagline">Never wonder what to do today.</p>
          <p className="landing-copy">
            A social decision platform where friends discover ideas, vote on
            plans, share reels, and move from “what now?” to “let’s go.”
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" to="/signup">
              Create your Zumers profile
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
          <h2>From “any plans?” to a shared decision.</h2>
          <p>
            Zumers brings feed, reels, friends, and chat into one flow so people
            can discover, compare, and commit without losing momentum.
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
            <span>What should we do today?</span>
            <button>Post</button>
          </div>
          <div className="landing-plan-card">
            <div>
              <strong>Rooftop dinner or late show?</strong>
              <small>12 friends deciding</small>
            </div>
            <div className="landing-votes">
              <span style={{ width: '74%' }} />
            </div>
          </div>
          <div className="landing-chat-preview">
            <MessageCircle size={18} />
            <span>Abhishek: I am in for dinner</span>
          </div>
          <div className="landing-reel-preview">
            <PlayCircle size={34} />
          </div>
        </div>
        <div className="landing-benefits">
          <p className="landing-section-label">Why Zumers</p>
          <h2>Built for the messy middle between discovery and action.</h2>
          <ul>
            <li>
              <CheckCircle2 size={20} />
              One place for friends, posts, reels, and plan-making.
            </li>
            <li>
              <CheckCircle2 size={20} />
              Decisions feel social, not like another task list.
            </li>
            <li>
              <CheckCircle2 size={20} />
              Mobile-first flows for quick plans on the move.
            </li>
          </ul>
          <Link className="landing-primary landing-inline-cta" to="/signup">
            Start deciding with friends
          </Link>
        </div>
      </section>
    </main>
  )
}
