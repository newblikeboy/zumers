import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  CheckCircle2,
  Clapperboard,
  Coffee,
  Compass,
  Dumbbell,
  Heart,
  LocateFixed,
  MapPin,
  Menu,
  MessageCircle,
  Mountain,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Ticket,
  Utensils,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { businessUrl } from '../lib/businessRoutes'

const pendingLandingSearchKey = 'zumers.pendingLandingSearch'

const promptSuggestions = [
  '4 friends ke liye street food tonight under Rs 1,000',
  'Peaceful cafe nearby for a date',
  'Live music this weekend under Rs 1,500',
  'Fun activity for 6 friends tonight',
]

const plannerChips = ['Tonight', '4 people', 'Under Rs 1,000', 'Within 5 km']

const intentCards = [
  { label: 'Dining', icon: Utensils, query: 'restaurant cafe dinner nearby', tone: 'coral' },
  { label: 'Street food', icon: Coffee, query: 'street food momos chaat nearby', tone: 'mint' },
  { label: 'Events', icon: Ticket, query: 'events concerts workshops theatre nearby', tone: 'violet' },
  { label: 'Activities', icon: Clapperboard, query: 'bowling arcade gaming karaoke escape room', tone: 'gold' },
  { label: 'Adventure', icon: Mountain, query: 'adventure go kart paintball trampoline nearby', tone: 'green' },
  { label: 'Nightlife', icon: Sparkles, query: 'nightlife pub bar dj late night', tone: 'ink' },
  { label: 'Sports', icon: Dumbbell, query: 'sports turf badminton football swimming', tone: 'blue' },
  { label: 'Shopping', icon: ShoppingBag, query: 'shopping market mall flea books nearby', tone: 'rose' },
  { label: 'Wellness', icon: Heart, query: 'spa salon wellness self care nearby', tone: 'teal' },
  { label: 'Day trips', icon: Compass, query: 'travel trip tour local guide nearby', tone: 'sky' },
]

const discoveryCards = [
  {
    title: 'Rooftop cafe for two',
    type: 'Date night',
    locality: 'Nearby',
    meta: 'Calm, easy to book',
    tone: 'coral',
  },
  {
    title: 'Street-food trail',
    type: 'Friends',
    locality: 'Market area',
    meta: 'Good under Rs 1,000',
    tone: 'mint',
  },
  {
    title: 'Live music evening',
    type: 'Events',
    locality: 'This weekend',
    meta: 'Best for groups',
    tone: 'violet',
  },
  {
    title: 'Bowling and snacks',
    type: 'Activities',
    locality: 'Mall road',
    meta: 'Works for 4-6 people',
    tone: 'gold',
  },
]

const useCases = [
  ['Date night', 'Quiet places, good timing, easy budget.'],
  ['Friends hangout', 'Food, games, events, and votes in one plan.'],
  ['Family outing', 'Nearby options that work for different ages.'],
  ['Peaceful solo time', 'Cafes, parks, wellness, and calm corners.'],
  ['Weekend adventure', 'Trips, activities, sports, and outdoor plans.'],
  ['Cafe work session', 'Comfortable spots with the right mood.'],
]

const footerLinks = {
  Zumers: [
    ['About', '#how-it-works'],
    ['How it works', '#how-it-works'],
    ['Contact', 'mailto:support@zumers.in'],
  ],
  Discover: [
    ['Food', '#intents'],
    ['Events', '#intents'],
    ['Activities', '#intents'],
    ['Cafes', '#intents'],
    ['Nightlife', '#intents'],
    ['Adventure', '#intents'],
  ],
  Community: [
    ['Feed', '/feed'],
    ['Reels', '/reels'],
    ['Friends', '/friends'],
  ],
  Business: [
    ['List your business', businessUrl('/signup')],
    ['Business login', businessUrl('/login')],
    ['Partner support', 'mailto:support@zumers.in'],
  ],
  Legal: [
    ['Privacy', 'mailto:support@zumers.in?subject=Privacy'],
    ['Terms', 'mailto:support@zumers.in?subject=Terms'],
    ['Safety', 'mailto:support@zumers.in?subject=Safety'],
  ],
}

export function LandingPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'ready' | 'denied'>('idle')
  const currentYear = new Date().getFullYear()

  function submitSearch(event?: FormEvent<HTMLFormElement>, nextQuery = query) {
    event?.preventDefault()
    const searchQuery = nextQuery.trim()
    if (!searchQuery && selectedChips.length === 0) return

    sessionStorage.setItem(
      pendingLandingSearchKey,
      JSON.stringify({
        autoRun: true,
        chips: selectedChips,
        key: Date.now(),
        latitude: location?.latitude,
        longitude: location?.longitude,
        query: searchQuery,
        radiusKm: selectedChips.includes('Within 5 km') ? 5 : undefined,
      }),
    )
    navigate('/signup')
  }

  function selectPrompt(prompt: string) {
    setQuery(prompt)
    submitSearch(undefined, prompt)
  }

  function selectIntent(item: (typeof intentCards)[number]) {
    sessionStorage.setItem(
      pendingLandingSearchKey,
      JSON.stringify({
        autoRun: true,
        chips: [item.label],
        key: Date.now(),
        latitude: location?.latitude,
        longitude: location?.longitude,
        query: item.query,
      }),
    )
    navigate('/signup')
  }

  function toggleChip(chip: string) {
    setSelectedChips((current) =>
      current.includes(chip)
        ? current.filter((item) => item !== chip)
        : [...current, chip],
    )
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationState('denied')
      return
    }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationState('ready')
      },
      () => setLocationState('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <main className="landing-page">
      <header className="landing-nav" aria-label="Zumers public navigation">
        <Link className="landing-brand" to="/">
          <span className="landing-brand-mark">Z</span>
          <span>Zumers</span>
        </Link>
        <nav className="landing-nav-links" aria-label="Primary navigation">
          <a href="#discover">Discover</a>
          <a href="#how-it-works">How it works</a>
          <a href="#friends">Plan with friends</a>
          <a href={businessUrl()}>For Business</a>
        </nav>
        <div className="landing-nav-actions">
          <button className="landing-location-button" type="button" onClick={useCurrentLocation}>
            <MapPin size={17} />
            <span>{locationState === 'ready' ? 'Location on' : 'Use location'}</span>
          </button>
          <Link className="landing-login" to="/login">Log in</Link>
          <Link className="landing-nav-cta" to="/signup">Join Zumers</Link>
          <button
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="landing-menu-button"
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {mobileMenuOpen ? (
          <div className="landing-mobile-menu">
            <a href="#discover" onClick={() => setMobileMenuOpen(false)}>Discover</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#friends" onClick={() => setMobileMenuOpen(false)}>Plan with friends</a>
            <a href={businessUrl()} onClick={() => setMobileMenuOpen(false)}>For Business</a>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Join Zumers</Link>
          </div>
        ) : null}
      </header>

      <section className="landing-hero" id="discover">
        <div className="landing-hero-copy">
          <span className="landing-kicker">
            <Sparkles size={17} />
            Your city, planned around you
          </span>
          <h1>Never Wonder What to Do Today.</h1>
          <p>
            Tell Zumers your mood, people, budget and location. Discover places,
            events and activities that fit, then plan them together with friends.
          </p>

          <form className="landing-planner" role="search" onSubmit={submitSearch}>
            <label aria-label="Describe your plan">
              <Search size={21} />
              <input
                value={query}
                placeholder="4 friends, street food tonight under Rs 1,000"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className="landing-location-control"
              disabled={locationState === 'loading'}
              type="button"
              onClick={useCurrentLocation}
            >
              <LocateFixed size={18} />
              <span>
                {locationState === 'loading'
                  ? 'Locating'
                  : locationState === 'ready'
                    ? 'Location ready'
                    : 'Use current location'}
              </span>
            </button>
            <button className="landing-primary" type="submit">
              Find a plan
              <ArrowRight size={18} />
            </button>
          </form>
          {locationState === 'denied' ? (
            <p className="landing-location-note">Location access is off. You can still search by city or locality.</p>
          ) : null}

          <div className="landing-planner-chips" aria-label="Planning shortcuts">
            {plannerChips.map((chip) => (
              <button
                className={selectedChips.includes(chip) ? 'active' : ''}
                key={chip}
                type="button"
                aria-pressed={selectedChips.includes(chip)}
                onClick={() => toggleChip(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="landing-prompt-row" aria-label="Example searches">
            {promptSuggestions.map((prompt) => (
              <button key={prompt} type="button" onClick={() => selectPrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="landing-value-row" aria-label="Zumers benefits">
            <span><Compass size={16} /> Discover around you</span>
            <span><CheckCircle2 size={16} /> Match mood and budget</span>
            <span><Users size={16} /> Plan with friends</span>
          </div>
        </div>

        <HeroProductPreview />
      </section>

      <section className="landing-section landing-intents" id="intents">
        <div className="landing-section-heading">
          <span>Popular planning intents</span>
          <h2>What are you in the mood for?</h2>
          <p>Choose a service or simply tell Zumers what you need.</p>
        </div>
        <div className="landing-intent-grid">
          {intentCards.map((item) => (
            <button
              className={`landing-intent-card ${item.tone}`}
              key={item.label}
              type="button"
              onClick={() => selectIntent(item)}
            >
              <item.icon size={24} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="landing-section landing-discovery">
        <div className="landing-section-heading">
          <span>Discovery preview</span>
          <h2>Plans people can shortlist nearby.</h2>
          <p>Real search results appear after location and business data are available.</p>
        </div>
        <div className="landing-discovery-grid">
          {discoveryCards.map((card) => (
            <article className={`landing-discovery-card ${card.tone}`} key={card.title}>
              <div className="landing-discovery-art">
                <Bookmark size={19} />
              </div>
              <div>
                <span>{card.type}</span>
                <h3>{card.title}</h3>
                <p>{card.locality} - {card.meta}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-smart-demo">
        <div>
          <span className="landing-section-label">One request, a complete plan</span>
          <h2>Zumers understands more than keywords.</h2>
          <p>
            Say the group size, budget, timing and mood in one sentence. Zumers
            turns that into structured options you can compare.
          </p>
        </div>
        <div className="landing-understands-card">
          <strong>4 friends ke liye fun activity tonight under Rs 1,500</strong>
          <ul>
            <li><span>Group</span><b>4 friends</b></li>
            <li><span>Intent</span><b>Fun activity</b></li>
            <li><span>Time</span><b>Tonight</b></li>
            <li><span>Budget</span><b>Under Rs 1,500</b></li>
          </ul>
          <button type="button" onClick={() => selectPrompt('4 friends ke liye fun activity tonight under Rs 1,500')}>
            Try this plan
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className="landing-section landing-friends-section" id="friends">
        <div className="landing-group-preview">
          <div className="landing-group-header">
            <span>Saturday plan</span>
            <div>
              <i>A</i>
              <i>R</i>
              <i>S</i>
            </div>
          </div>
          <article>
            <strong>Bowling and snacks</strong>
            <span>2 votes - fits budget</span>
          </article>
          <article>
            <strong>Live music evening</strong>
            <span>1 vote - starts late</span>
          </article>
          <div className="landing-final-choice">
            <Vote size={18} />
            Finalise together
          </div>
        </div>
        <div>
          <span className="landing-section-label">Plan together</span>
          <h2>Good plans are better together.</h2>
          <p>
            Create a plan, invite friends, shortlist options and decide without
            hundreds of confusing messages.
          </p>
          <Link className="landing-secondary-dark" to="/signup">Create a group plan</Link>
        </div>
      </section>

      <section className="landing-section landing-use-cases">
        <div className="landing-section-heading">
          <span>Use cases</span>
          <h2>Whatever the mood, there is a plan.</h2>
        </div>
        <div className="landing-use-case-grid">
          {useCases.map(([title, text], index) => (
            <article key={title} className={index % 3 === 0 ? 'wide' : ''}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-how" id="how-it-works">
        {[
          ['Tell us what you need', 'Mention mood, people, timing, budget and location in your own words.'],
          ['Get matching options', 'Compare places, activities and events selected for your requirement.'],
          ['Plan it together', 'Invite friends, shortlist options and finalise the plan.'],
        ].map(([title, text], index) => (
          <article key={title}>
            <span>{index + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="landing-section landing-local">
        <div>
          <span className="landing-section-label">Local relevance</span>
          <h2>Made for your city and your kind of day.</h2>
          <p>
            Suggestions can consider selected locality, available time, group
            size, budget, mood, occasion, open status and distance. Location is
            used only when you choose it.
          </p>
        </div>
      </section>

      <section className="landing-section landing-business-cta">
        <div>
          <BriefcaseBusiness size={26} />
          <h2>Bring your business into people's next plan.</h2>
          <p>
            Show offers, experiences and events to customers who are actively
            deciding what to do.
          </p>
        </div>
        <div>
          <a className="landing-primary" href={businessUrl('/signup')}>List your business</a>
          <a className="landing-link-button" href={businessUrl()}>Learn about Zumers for Business</a>
        </div>
      </section>

      <section className="landing-final-cta">
        <h2>Your next plan is closer than you think.</h2>
        <p>Tell Zumers what you feel like doing and discover the right plan for today.</p>
        <div>
          <button type="button" className="landing-primary" onClick={() => selectPrompt('Find my next plan nearby')}>
            Find my next plan
          </button>
          <Link className="landing-secondary-light" to="/signup">Join Zumers</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span className="landing-brand-mark">Z</span>
          <strong>Zumers</strong>
          <p>Never Wonder What to Do Today.</p>
        </div>
        <div className="landing-footer-grid">
          {Object.entries(footerLinks).map(([group, links]) => (
            <nav key={group} aria-label={group}>
              <strong>{group}</strong>
              {links.map(([label, href]) =>
                href.startsWith('/') ? (
                  <Link key={label} to={href}>{label}</Link>
                ) : (
                  <a key={label} href={href}>{label}</a>
                ),
              )}
            </nav>
          ))}
        </div>
        <p className="landing-copyright">Copyright {currentYear} Zumers. All rights reserved.</p>
      </footer>
    </main>
  )
}

function HeroProductPreview() {
  return (
    <aside className="landing-product-preview" aria-label="Zumers product preview">
      <div className="landing-preview-card primary">
        <span>Best match</span>
        <h2>Street-food trail for 4 friends</h2>
        <p>Under Rs 1,000 - near your area - open tonight</p>
        <button type="button">Add to plan</button>
      </div>
      <div className="landing-preview-row">
        <article>
          <Ticket size={18} />
          <strong>Live music</strong>
          <span>Weekend option</span>
        </article>
        <article>
          <Users size={18} />
          <strong>3 friends voted</strong>
          <span>One clear winner</span>
        </article>
      </div>
      <div className="landing-preview-chat">
        <MessageCircle size={18} />
        <span>Looks good for everyone. Finalise?</span>
      </div>
      <div className="landing-preview-share">
        <Share2 size={17} />
        <span>Shareable plan card</span>
      </div>
    </aside>
  )
}
