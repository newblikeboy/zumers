import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  CalendarCheck,
  Check,
  ChevronDown,
  Clapperboard,
  Coffee,
  Compass,
  Dumbbell,
  Flame,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Mountain,
  Newspaper,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Tags,
  Ticket,
  Utensils,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import {
  discoveryDemoSections,
  type DiscoverySectionData,
  type DiscoveryShowcaseItem,
} from '../lib/discoveryDemoData'
import { preloadChatData } from '../lib/chatDataCache'
import type {
  Conversation,
  DiscoverySearchResult,
  FriendRequest,
  NotificationItem,
  User,
} from '../lib/types'

const navItems = [
  { to: '/', label: 'Plan', icon: Sparkles },
  { to: '/feed', label: 'Feed', icon: Newspaper },
  { to: '/reels', label: 'Reels', icon: Clapperboard },
  { to: '/friends', label: 'Friends', icon: Users },
]

const mobileNavItems = [
  ...navItems,
  { to: '/profile', label: 'Profile', icon: UserIcon },
]

const discoveryServices = [
  {
    label: 'Dining Plans',
    icon: Utensils,
    query: 'restaurant cafe dinner nearby',
    chips: ['Restaurant or cafe', 'dinner'],
  },
  {
    label: 'Street Bites',
    icon: Flame,
    query: 'street food momos chaat nearby',
    chips: ['Street food', 'quick-bite'],
  },
  {
    label: 'Events',
    icon: Ticket,
    query: 'events concerts workshops theatre nearby',
    chips: ['Culture and events'],
  },
  {
    label: 'Fun Zones',
    icon: Clapperboard,
    query: 'bowling arcade gaming karaoke escape room',
    chips: ['Fun and entertainment'],
  },
  {
    label: 'Adventure',
    icon: Mountain,
    query: 'adventure go kart paintball trampoline nearby',
    chips: ['Adventure'],
  },
  {
    label: 'Nightlife',
    icon: Sparkles,
    query: 'nightlife pub bar dj late night',
    chips: ['Nightlife', 'late-night'],
  },
  {
    label: 'Sports',
    icon: Dumbbell,
    query: 'sports turf badminton football swimming',
    chips: ['Sports and fitness'],
  },
  {
    label: 'Wellness',
    icon: Heart,
    query: 'spa salon wellness self care nearby',
    chips: ['Wellness and self care'],
  },
  {
    label: 'Shopping',
    icon: ShoppingBag,
    query: 'shopping market mall flea books nearby',
    chips: ['Shopping and markets'],
  },
  {
    label: 'Day Trips',
    icon: Compass,
    query: 'travel trip tour local guide nearby',
    chips: ['Travel or transport'],
  },
  {
    label: 'Heritage',
    icon: CalendarCheck,
    query: 'heritage monument temple museum photo spot',
    chips: ['Attractions and heritage'],
  },
  {
    label: 'Learn',
    icon: Coffee,
    query: 'art dance music cooking pottery class',
    chips: ['Learning and hobbies'],
  },
]

const discoveryRailDotIndexes = [0, 1, 2]

const discoveryRecentSearchesKey = 'zumers.discoveryRecentSearches'
const discoverySavedBusinessesKey = 'zumers.discoverySavedBusinesses'
const discoveryLocationCacheKey = 'zumers.discoveryLocation'
const pendingBusinessShareKey = 'zumers.pendingBusinessShare'
const pendingLandingSearchKey = 'zumers.pendingLandingSearch'
const discoveryLocationCacheMaxAgeMs = 6 * 60 * 60 * 1000
const discoveryFallbackSearches = [
  'street food under 500',
  'bowling for 4 friends',
  'date cafe tonight',
  'events today nearby',
]

const popularLocationOptions = [
  { name: 'Delhi NCR', detail: 'New Delhi, Gurugram, Noida' },
  { name: 'Mumbai', detail: 'Bandra, Andheri, Powai' },
  { name: 'Kolkata', detail: 'Park Street, Salt Lake' },
  { name: 'Bengaluru', detail: 'Indiranagar, Koramangala' },
  { name: 'Hyderabad', detail: 'Banjara Hills, HITEC City' },
  { name: 'Chandigarh', detail: 'Sector 17, Elante' },
]

const allLocationOptions = [
  'Abohar',
  'Abu Dhabi',
  'Abu Road',
  'Achampet',
  'Acharapakkam',
  'Addanki',
  'Adilabad',
  'Ahmedabad',
  'Bengaluru',
  'Chandigarh',
  'Chennai',
  'Delhi NCR',
  'Gurugram',
  'Hyderabad',
  'Jaipur',
  'Kolkata',
  'Lucknow',
  'Mumbai',
  'New Delhi',
  'Noida',
  'Pune',
]

export type DiscoverySearchPreset = {
  autoRun?: boolean
  chips?: string[]
  key: number
  latitude?: number
  longitude?: number
  query: string
  radiusKm?: number
}

type DiscoverySearchOverrides = {
  latitude?: number
  longitude?: number
  radiusKm?: number
  useNearby?: boolean
}

type DiscoveryCachedLocation = {
  accuracy?: number
  label?: string
  latitude: number
  longitude: number
  primary?: string
  secondary?: string
  savedAt: number
}

function containsCoordinatePair(value: string) {
  return /-?\d+\.\d+,\s*-?\d+\.\d+/.test(value)
}

function cleanDisplayLocation(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed || containsCoordinatePair(trimmed)) return ''
  return trimmed
}

function isValidDiscoveryLocation(value: unknown): value is DiscoveryCachedLocation {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DiscoveryCachedLocation>
  if (
    (candidate.label && containsCoordinatePair(candidate.label)) ||
    (candidate.secondary && containsCoordinatePair(candidate.secondary))
  ) {
    return false
  }
  return (
    typeof candidate.latitude === 'number' &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    typeof candidate.longitude === 'number' &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180 &&
    typeof candidate.savedAt === 'number' &&
    Date.now() - candidate.savedAt <= discoveryLocationCacheMaxAgeMs
  )
}

function readDiscoveryCachedLocation() {
  try {
    const raw = localStorage.getItem(discoveryLocationCacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isValidDiscoveryLocation(parsed)) {
      localStorage.removeItem(discoveryLocationCacheKey)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeDiscoveryCachedLocation(cachedLocation: DiscoveryCachedLocation) {
  try {
    localStorage.setItem(discoveryLocationCacheKey, JSON.stringify(cachedLocation))
  } catch {
    // Search still works with in-memory coordinates when storage is unavailable.
  }
}

function saveDiscoveryCachedLocation(position: GeolocationPosition): DiscoveryCachedLocation {
  const cachedLocation: DiscoveryCachedLocation = {
    accuracy: position.coords.accuracy,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    savedAt: Date.now(),
  }
  writeDiscoveryCachedLocation(cachedLocation)
  return cachedLocation
}

async function hydrateDiscoveryLocationLabel(cachedLocation: DiscoveryCachedLocation) {
  if (cachedLocation.label) return cachedLocation

  try {
    const response = await api.reverseLocation({
      latitude: cachedLocation.latitude,
      longitude: cachedLocation.longitude,
    })
    const nextLocation = {
      ...cachedLocation,
      label: response.location,
      primary: response.primary,
      secondary: response.secondary,
      savedAt: Date.now(),
    }
    writeDiscoveryCachedLocation(nextLocation)
    return nextLocation
  } catch {
    const nextLocation = {
      ...cachedLocation,
      label: 'Current location',
      primary: 'Current location',
      secondary: '',
      savedAt: Date.now(),
    }
    writeDiscoveryCachedLocation(nextLocation)
    return nextLocation
  }
}

async function getDiscoveryLocation(): Promise<DiscoveryCachedLocation> {
  const cachedLocation = readDiscoveryCachedLocation()
  if (cachedLocation) return hydrateDiscoveryLocationLabel(cachedLocation)

  if (!navigator.geolocation) {
    return Promise.reject(new Error('Location is not available'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void hydrateDiscoveryLocationLabel(saveDiscoveryCachedLocation(position)).then(resolve)
      },
      () => reject(new Error('Could not read location')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: discoveryLocationCacheMaxAgeMs },
    )
  })
}

export function AppLayout() {
  const { user, logout, setUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [headerLocationBusy, setHeaderLocationBusy] = useState(false)
  const [headerLocationError, setHeaderLocationError] = useState<string | null>(null)
  const isPlan = location.pathname === '/'
  const isReels = location.pathname.startsWith('/reels')
  const isFriends = location.pathname.startsWith('/friends')
  const isChat = location.pathname.startsWith('/chat')
  const showRightRail = location.pathname === '/feed'
  const [isMobileHeader, setIsMobileHeader] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 760px)').matches
      : false,
  )
  const [friends, setFriends] = useState<User[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [contactQuery, setContactQuery] = useState('')
  const [chatDockLoading, setChatDockLoading] = useState(false)
  const [chatDockError, setChatDockError] = useState<string | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [currentLocationCandidateLabel, setCurrentLocationCandidateLabel] = useState(() => {
    const cachedLocation = readDiscoveryCachedLocation()
    return cachedLocation?.label ?? ''
  })
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [notificationBusy, setNotificationBusy] = useState<string | null>(null)

  async function loadNotifications() {
    const [notificationResponse, requestResponse] = await Promise.all([
      api.notifications(),
      api.friendRequests(),
    ])
    setNotifications(notificationResponse.notifications)
    setFriendRequests(
      requestResponse.friend_requests.filter((request) => request.status === 'pending'),
    )
  }

  useEffect(() => {
    loadNotifications().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const timer = window.setTimeout(() => {
      preloadChatData(user.id).catch(() => undefined)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [user?.id])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)')
    const update = () => setIsMobileHeader(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setNotificationOpen(false)
    setProfileMenuOpen(false)
    setLocationPickerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!showRightRail) return
    setChatDockLoading(true)
    setChatDockError(null)
    Promise.all([api.friends(), api.conversations()])
      .then(([friendResponse, conversationResponse]) => {
        setFriends(friendResponse.friends)
        setConversations(conversationResponse.conversations)
      })
      .catch((err) =>
        setChatDockError(
          err instanceof Error ? err.message : 'Could not load contacts',
        ),
      )
      .finally(() => setChatDockLoading(false))
  }, [showRightRail])

  const contacts = useMemo(() => {
    const conversationByUser = new Map<number, Conversation>()
    conversations.forEach((conversation) => {
      if (conversation.other_user) {
        conversationByUser.set(conversation.other_user.id, conversation)
      }
    })

    const byID = new Map<number, User>()
    friends.forEach((friend) => byID.set(friend.id, friend))
    conversations.forEach((conversation) => {
      if (conversation.other_user) {
        byID.set(conversation.other_user.id, conversation.other_user)
      }
    })

    const term = contactQuery.trim().toLowerCase()
    return [...byID.values()]
      .map((friend) => {
        const conversation = conversationByUser.get(friend.id)
        const lastActivity =
          conversation?.latest_message?.created_at ?? conversation?.updated_at
        return {
          friend,
          conversation,
          isOnline: isRecentlyActive(lastActivity),
          lastActivity,
        }
      })
      .filter(({ friend }) => {
        if (!term) return true
        return `${friend.display_name} ${friend.username}`
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
        return dateValue(b.lastActivity) - dateValue(a.lastActivity)
      })
  }, [contactQuery, conversations, friends])

  const recentContacts = contacts
    .filter((contact) => contact.conversation)
    .slice(0, 5)
  const recentContactIDs = new Set(
    recentContacts.map((contact) => contact.friend.id),
  )
  const onlineContacts = contacts.filter(
    (contact) => contact.isOnline && !recentContactIDs.has(contact.friend.id),
  )
  const offlineContacts = contacts.filter(
    (contact) => !contact.isOnline && !recentContactIDs.has(contact.friend.id),
  )

  async function openFriendChat(friend: User) {
    setChatDockError(null)
    try {
      await api.createConversation(friend.id)
      navigate('/chat')
    } catch (err) {
      setChatDockError(
        err instanceof Error ? err.message : 'Could not open chat',
      )
    }
  }

  async function openNotificationPanel() {
    setNotificationOpen((current) => !current)
    setProfileMenuOpen(false)
    setLocationPickerOpen(false)
    setNotificationLoading(true)
    setNotificationError(null)
    try {
      await loadNotifications()
    } catch (err) {
      setNotificationError(
        err instanceof Error ? err.message : 'Could not load notifications',
      )
    } finally {
      setNotificationLoading(false)
    }
  }

  async function markNotificationRead(item: NotificationItem) {
    if (item.read_at) return
    setNotificationBusy(`notification-${item.id}`)
    setNotificationError(null)
    try {
      await api.markNotificationRead(item.id)
      await loadNotifications()
    } catch (err) {
      setNotificationError(
        err instanceof Error ? err.message : 'Could not update notification',
      )
    } finally {
      setNotificationBusy(null)
    }
  }

  async function answerFriendRequest(id: number, action: 'accept' | 'reject') {
    setNotificationBusy(`${action}-${id}`)
    setNotificationError(null)
    try {
      if (action === 'accept') {
        await api.acceptFriendRequest(id)
      } else {
        await api.rejectFriendRequest(id)
      }
      await loadNotifications()
    } catch (err) {
      setNotificationError(
        err instanceof Error ? err.message : 'Could not update friend request',
      )
    } finally {
      setNotificationBusy(null)
    }
  }

  const activityNotifications = notifications.filter(
    (item) => item.notification_type !== 'friend_request',
  )
  const unreadNotificationCount = activityNotifications.filter((item) => !item.read_at).length
  const notificationBadgeCount = unreadNotificationCount + friendRequests.length
  const visibleNotifications =
    notificationFilter === 'unread'
      ? activityNotifications.filter((item) => !item.read_at)
      : activityNotifications
  const currentLocationLabel = cleanDisplayLocation(user?.location) || 'Use current location'
  const currentLocationParts = splitLocationLabel(currentLocationLabel)
  const displayedLocationLabel = headerLocationBusy ? 'Locating' : currentLocationParts.primary
  const filteredLocationOptions = useMemo(() => {
    const term = locationQuery.trim().toLowerCase()
    if (!term) return allLocationOptions
    return allLocationOptions.filter((item) => item.toLowerCase().includes(term))
  }, [locationQuery])

  const frameClass = [
    'app-frame',
    showRightRail ? 'with-right-rail' : 'content-wide',
    isPlan ? 'plan-shell' : '',
    isReels ? 'reels-shell' : '',
    isFriends ? 'friends-shell' : '',
    isChat ? 'chat-page-shell' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function useHeaderLocation() {
    setHeaderLocationError(null)
    setHeaderLocationBusy(true)
    getDiscoveryLocation()
      .then((cachedLocation) => {
        const nextLocationLabel =
          cachedLocation.label ?? 'Current location'
        const preset: DiscoverySearchPreset = {
          autoRun: true,
          chips: ['Nearby'],
          key: Date.now(),
          latitude: cachedLocation.latitude,
          longitude: cachedLocation.longitude,
          query: '',
          radiusKm: 5,
        }
        setCurrentLocationCandidateLabel(nextLocationLabel)
        sessionStorage.setItem(pendingLandingSearchKey, JSON.stringify(preset))
        if (user) {
          setUser({ ...user, location: nextLocationLabel })
          void api.updateProfile({ location: nextLocationLabel }).catch(() => undefined)
        }
        setHeaderLocationBusy(false)
        setLocationPickerOpen(false)
        setLocationQuery('')
        navigate('/', { state: { discoveryPreset: preset } })
      })
      .catch((err) => {
        setHeaderLocationError(err instanceof Error ? err.message : 'Could not read location')
        setHeaderLocationBusy(false)
      })
  }

  function selectHeaderLocation(nextLocation: string) {
    setHeaderLocationError(null)
    setLocationPickerOpen(false)
    setLocationQuery('')
    if (user) {
      setUser({ ...user, location: nextLocation })
      void api.updateProfile({ location: nextLocation }).catch(() => undefined)
    }
    const preset: DiscoverySearchPreset = {
      autoRun: true,
      chips: [],
      key: Date.now(),
      query: nextLocation,
    }
    sessionStorage.setItem(pendingLandingSearchKey, JSON.stringify(preset))
    navigate('/', { state: { discoveryPreset: preset } })
  }

  function warmChatData() {
    if (!user?.id) return
    preloadChatData(user.id).catch(() => undefined)
  }

  const notificationPopover = notificationOpen ? (
    <div className="notification-popover" role="dialog" aria-label="Activity">
      <div className="notification-popover-header">
        <h2>Activity</h2>
        <button
          aria-label="Close activity"
          className="icon-button quiet"
          type="button"
          onClick={() => setNotificationOpen(false)}
        >
          <X size={19} />
        </button>
      </div>
      <div className="notification-tabs" role="tablist" aria-label="Activity filters">
        <button
          className={notificationFilter === 'all' ? 'active' : ''}
          type="button"
          onClick={() => setNotificationFilter('all')}
        >
          All
        </button>
        <button
          className={notificationFilter === 'unread' ? 'active' : ''}
          type="button"
          onClick={() => setNotificationFilter('unread')}
        >
          Unread
        </button>
      </div>
      {notificationError ? (
        <div className="inline-error">{notificationError}</div>
      ) : null}
      <div className="notification-popover-body">
        {notificationLoading ? (
          <div className="chat-dock-state">Loading notifications</div>
        ) : null}
        {!notificationLoading &&
        friendRequests.length === 0 &&
        visibleNotifications.length === 0 ? (
          <div className="notification-empty">No activity yet</div>
        ) : null}
        {!notificationLoading && friendRequests.length > 0 ? (
          <section className="notification-group">
            <div className="notification-group-heading">
              <h3>New</h3>
              <NavLink to="/friends">Friends</NavLink>
            </div>
            {friendRequests.map((request) => (
              <article className="notification-request-card" key={request.id}>
                <Avatar
                  name={request.sender?.display_name ?? 'Friend'}
                  src={request.sender?.avatar_url}
                />
                <div>
                  <p>
                    <strong>{request.sender?.display_name ?? 'Someone'}</strong>
                    {' sent an invite.'}
                  </p>
                  <span>{formatContactTime(request.created_at)}</span>
                  <div className="notification-request-actions">
                    <button
                      className="primary-button"
                      disabled={notificationBusy === `accept-${request.id}`}
                      type="button"
                      onClick={() => answerFriendRequest(request.id, 'accept')}
                    >
                      Confirm
                    </button>
                    <button
                      className="ghost-button"
                      disabled={notificationBusy === `reject-${request.id}`}
                      type="button"
                      onClick={() => answerFriendRequest(request.id, 'reject')}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <span className="notification-dot" />
              </article>
            ))}
          </section>
        ) : null}
        {!notificationLoading && visibleNotifications.length > 0 ? (
          <section className="notification-group">
            <div className="notification-group-heading">
              <h3>{friendRequests.length > 0 ? 'Earlier' : 'New'}</h3>
              <NavLink to="/notifications">Activity</NavLink>
            </div>
            {visibleNotifications.map((item) => (
              <button
                className={
                  item.read_at
                    ? 'notification-popover-item read'
                    : 'notification-popover-item'
                }
                disabled={notificationBusy === `notification-${item.id}`}
                key={item.id}
                type="button"
                onClick={() => markNotificationRead(item)}
              >
                <span className="notification-type-icon">
                  {item.read_at ? <Check size={18} /> : <Bell size={18} />}
                </span>
                <span>
                  <strong>{labelForNotification(item.notification_type)}</strong>
                  <small>{formatContactTime(item.created_at)}</small>
                </span>
                {!item.read_at ? <span className="notification-dot" /> : null}
              </button>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  ) : null

  return (
    <div className={frameClass}>
      <header className="topbar">
        <NavLink aria-label="Zumers home" className="topbar-left brand-home" to="/">
          <div className="brand-mark">Z</div>
          <strong className="topbar-product-name">Zumers</strong>
        </NavLink>

        <button
          className="topbar-location"
          aria-controls="location-picker"
          aria-expanded={locationPickerOpen}
          aria-label={`Change location. Current: ${currentLocationLabel}`}
          disabled={headerLocationBusy}
          title={headerLocationError ?? 'Change location'}
          type="button"
          onClick={() => {
            setHeaderLocationError(null)
            setNotificationOpen(false)
            setProfileMenuOpen(false)
            setLocationPickerOpen(true)
          }}
        >
          <MapPin size={17} />
          <span className="topbar-location-text">
            <strong>{displayedLocationLabel}</strong>
            {currentLocationParts.secondary && !headerLocationBusy ? <small>{currentLocationParts.secondary}</small> : null}
          </span>
          <ChevronDown className="topbar-location-chevron" size={15} />
        </button>

        <nav className="topbar-tabs" aria-label="Primary sections">
          {navItems.map((item) => (
            <NavLink
              aria-label={item.label}
              className={({ isActive }) =>
                isActive ? 'topbar-tab active' : 'topbar-tab'
              }
              end={item.to === '/'}
              key={item.to}
              to={item.to}
            >
              <item.icon size={25} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <NavLink
            aria-label="Messages"
            className={({ isActive }) =>
              isActive ? 'topbar-icon active' : 'topbar-icon'
            }
            title="Messages"
            to="/chat"
            onFocus={warmChatData}
            onPointerEnter={warmChatData}
            onTouchStart={warmChatData}
          >
            <MessageCircle size={21} />
          </NavLink>
          <div className="notification-anchor">
            <button
              aria-expanded={notificationOpen}
              aria-label="Activity"
              className={notificationOpen ? 'topbar-icon active' : 'topbar-icon'}
              title="Activity"
              type="button"
              onClick={openNotificationPanel}
            >
              <Bell size={21} />
              {notificationBadgeCount > 0 ? (
                <span className="notification-badge">
                  {notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}
                </span>
              ) : null}
            </button>
            {!isMobileHeader ? notificationPopover : null}
          </div>
          <div className="current-user">
            <button
              aria-expanded={profileMenuOpen}
              aria-label="Account menu"
              className="current-user-toggle"
              type="button"
              onClick={() => {
                setProfileMenuOpen((value) => !value)
                setNotificationOpen(false)
                setLocationPickerOpen(false)
              }}
            >
              <Avatar name={user?.display_name ?? 'U'} src={user?.avatar_url} />
              <span>
                <ChevronDown size={13} />
              </span>
            </button>
            {profileMenuOpen ? (
              <div className="profile-menu">
                <NavLink to="/profile" onClick={() => setProfileMenuOpen(false)}>
                  <Avatar name={user?.display_name ?? 'U'} src={user?.avatar_url} />
                  <div>
                    <strong>{user?.display_name}</strong>
                    <span>{user?.email}</span>
                  </div>
                </NavLink>
                <button type="button" onClick={logout}>
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {isMobileHeader ? notificationPopover : null}

      {locationPickerOpen ? (
        <div
          className="location-picker-overlay"
          id="location-picker"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLocationPickerOpen(false)
          }}
        >
          <section className="location-picker-panel" role="dialog" aria-modal="true" aria-label="Choose location">
            <div className="location-picker-header">
              <button
                aria-label="Close location picker"
                className="icon-button quiet"
                type="button"
                onClick={() => setLocationPickerOpen(false)}
              >
                <ChevronDown size={22} />
              </button>
              <h2>Location</h2>
            </div>

            <label className="location-picker-search">
              <Search size={21} />
              <input
                autoFocus
                placeholder="Search city, area or locality"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
              />
            </label>

            <button
              className="location-current-card"
              disabled={headerLocationBusy}
              type="button"
              onClick={useHeaderLocation}
            >
              <span className="location-current-dot" />
              <span>
                <strong>{headerLocationBusy ? 'Locating' : 'Use current location'}</strong>
                <small>{currentLocationCandidateLabel || 'Tap to personalize nearby plans'}</small>
              </span>
              <ArrowRight size={19} />
            </button>

            {headerLocationError ? <div className="location-picker-error">{headerLocationError}</div> : null}

            <section className="location-picker-section">
              <h3>Popular cities</h3>
              <div className="location-popular-grid">
                {popularLocationOptions.map((item) => (
                  <button key={item.name} type="button" onClick={() => selectHeaderLocation(item.name)}>
                    <MapPin size={30} />
                    <strong>{item.name}</strong>
                    <small>{item.detail}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="location-picker-section">
              <h3>All cities</h3>
              <div className="location-city-list">
                {filteredLocationOptions.map((item) => (
                  <button key={item} type="button" onClick={() => selectHeaderLocation(item)}>
                    {item}
                  </button>
                ))}
                {filteredLocationOptions.length === 0 ? (
                  <span className="location-empty">No matching city</span>
                ) : null}
              </div>
            </section>
          </section>
        </div>
      ) : null}

      <main className="main-area">
        <Outlet />
      </main>

      {showRightRail ? (
        <aside className="right-rail" aria-label="Feed context">
          <section className="right-rail-section desktop-only">
            <div className="right-rail-heading">
              <h2>Attention</h2>
              <NavLink to="/notifications">Activity</NavLink>
            </div>
            <div className="request-preview">
              <Avatar name="F" />
              <div>
                <strong>Friends</strong>
                <span>Invites and suggestions</span>
              </div>
            </div>
          </section>

          <section className="right-rail-section desktop-only">
            <div className="right-rail-heading">
              <h2>Tonight</h2>
            </div>
            <p className="rail-muted">Food, events and activities nearby.</p>
          </section>

          <section className="right-rail-section contacts-rail">
            <div className="right-rail-heading">
              <h2>Friends</h2>
              <div className="rail-actions">
                <button
                  aria-label="Search contacts"
                  className="icon-button quiet"
                  type="button"
                >
                  <Search size={18} />
                </button>
                <button
                  aria-label="More contact options"
                  className="icon-button quiet"
                  type="button"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
            <label className="contact-search">
              <Search size={17} />
              <input
                aria-label="Search contacts"
                placeholder="Search people"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
              />
            </label>
            {chatDockError ? (
              <div className="inline-error">{chatDockError}</div>
            ) : null}
            {chatDockLoading ? (
              <div className="chat-dock-state">Loading contacts</div>
            ) : null}
            {!chatDockLoading && contacts.length === 0 ? (
              <div className="chat-dock-state">No people to show</div>
            ) : null}
            {!chatDockLoading && contacts.length > 0 ? (
              <div className="chat-dock-list">
                <ContactSection
                  contacts={recentContacts}
                  emptyLabel="No recent"
                  onOpen={openFriendChat}
                  title="Recent"
                />
                <ContactSection
                  contacts={onlineContacts}
                  emptyLabel="No active people"
                  onOpen={openFriendChat}
                  title="Active now"
                />
                <ContactSection
                  contacts={offlineContacts}
                  emptyLabel="No more people"
                  onOpen={openFriendChat}
                  title="People"
                />
              </div>
            ) : null}
          </section>

        </aside>
      ) : null}

      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        {mobileNavItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              isActive ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'
            }
            end={item.to === '/'}
            key={item.to}
            to={item.to}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function DiscoverySearchPanel({
  autoFocus = false,
  onClose,
  preset,
  title = 'Find the move',
}: {
  autoFocus?: boolean
  onClose?: () => void
  preset?: DiscoverySearchPreset
  title?: string
}) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadDiscoveryRecentSearches())
  const [results, setResults] = useState<DiscoverySearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [nearbyEnabled, setNearbyEnabled] = useState(false)
  const [locationBusy, setLocationBusy] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const radiusKm = 5
  const chipRailRef = useRef<HTMLDivElement | null>(null)
  const autoRunPresetKeyRef = useRef<number | null>(null)
  const [chipRailPage, setChipRailPage] = useState(0)
  const [activeService, setActiveService] = useState<string | null>(null)
  const firstName = firstUserName(user)
  const showcaseSections = useMemo(() => buildDiscoverySections(results), [results])
  const heroPreviewItems = showcaseSections[0]?.items.slice(0, 3) ?? []
  const showBrowseSections = !loading && !searched

  useEffect(() => {
    if (!preset) return
    const presetChips = preset.chips ?? []
    setQuery(preset.query)
    setSelectedChips(presetChips)
    setActiveService(null)
    const hasPresetLocation = typeof preset.latitude === 'number' && typeof preset.longitude === 'number'
    setLocation(
      hasPresetLocation
        ? { latitude: preset.latitude as number, longitude: preset.longitude as number }
        : null,
    )
    setNearbyEnabled(hasPresetLocation)
    setResults([])
    setSearched(false)
    setError(null)
    if (preset.autoRun && autoRunPresetKeyRef.current !== preset.key) {
      autoRunPresetKeyRef.current = preset.key
      void runSearch(preset.query, presetChips, {
        latitude: preset.latitude,
        longitude: preset.longitude,
        radiusKm: preset.radiusKm,
      })
    }
  }, [preset])

  useEffect(() => {
    syncChipRailPage()
    window.addEventListener('resize', syncChipRailPage)
    return () => {
      window.removeEventListener('resize', syncChipRailPage)
    }
  }, [])

  async function runSearch(
    searchQuery: string,
    chips: string[],
    overrides: DiscoverySearchOverrides = {},
  ) {
    const trimmedQuery = searchQuery.trim()
    if (trimmedQuery) {
      setRecentSearches(saveDiscoveryRecentSearch(trimmedQuery))
    }
    const shouldUseNearby = overrides.useNearby ?? (nearbyEnabled || overrides.latitude !== undefined)
    const cachedLocation = shouldUseNearby && !location && overrides.latitude === undefined
      ? readDiscoveryCachedLocation()
      : null
    if (cachedLocation) {
      setLocation({ latitude: cachedLocation.latitude, longitude: cachedLocation.longitude })
    }
    const latitude = overrides.latitude ?? location?.latitude ?? cachedLocation?.latitude
    const longitude = overrides.longitude ?? location?.longitude ?? cachedLocation?.longitude
    const hasLocation = shouldUseNearby && typeof latitude === 'number' && typeof longitude === 'number'
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const response = await api.discoverySearch({
        query: searchQuery,
        chips,
        latitude: hasLocation ? latitude : undefined,
        longitude: hasLocation ? longitude : undefined,
        radiusKm: hasLocation ? (overrides.radiusKm ?? radiusKm) : undefined,
        limit: 20,
      })
      setResults(response.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search plans')
    } finally {
      setLoading(false)
    }
  }

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setActiveService(null)
    await runSearch(query, selectedChips)
  }

  function toggleChip(chip: string) {
    if (chip === 'Nearby' && selectedChips.includes(chip)) {
      setNearbyEnabled(false)
    }
    setSelectedChips((current) =>
      current.includes(chip)
        ? current.filter((item) => item !== chip)
        : [...current, chip],
    )
  }

  async function toggleNearbySearch() {
    if (nearbyEnabled) {
      const nextChips = selectedChips.filter((chip) => chip !== 'Nearby')
      setNearbyEnabled(false)
      setSelectedChips(nextChips)
      await runSearch(query, nextChips, { useNearby: false })
      return
    }

    setLocationError(null)
    setLocationBusy(true)
    try {
      const cachedLocation = await getDiscoveryLocation()
      const nextLocation = {
        latitude: cachedLocation.latitude,
        longitude: cachedLocation.longitude,
      }
      const nextChips = selectedChips.includes('Nearby')
        ? selectedChips
        : [...selectedChips, 'Nearby']
      setLocation(nextLocation)
      setNearbyEnabled(true)
      setSelectedChips(nextChips)
      await runSearch(query, nextChips, {
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        radiusKm,
        useNearby: true,
      })
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Could not read location')
    } finally {
      setLocationBusy(false)
    }
  }

  function exploreService(service: (typeof discoveryServices)[number]) {
    setActiveService(service.label)
    void runSearch(service.query, service.chips)
  }

  function exploreItem(item: DiscoveryShowcaseItem) {
    const nextQuery = `${item.title} ${item.locality}`.trim()
    setQuery(nextQuery)
    void runSearch(nextQuery, [item.category])
  }

  function selectRecentSearch(item: string) {
    setQuery(item)
    void runSearch(item, selectedChips)
  }

  function removeRecentSearch(item: string) {
    const next = recentSearches.filter(
      (recent) => recent.toLowerCase() !== item.toLowerCase(),
    )
    localStorage.setItem(discoveryRecentSearchesKey, JSON.stringify(next))
    setRecentSearches(next)
  }

  function clearRecentSearches() {
    localStorage.removeItem(discoveryRecentSearchesKey)
    setRecentSearches([])
  }

  function closeSearchResults() {
    setResults([])
    setSearched(false)
    setLoading(false)
    setError(null)
    setActiveService(null)
  }

  function syncChipRailPage() {
    const rail = chipRailRef.current
    if (!rail) return

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth
    const nextPage =
      maxScrollLeft <= 0
        ? 0
        : Math.round((rail.scrollLeft / maxScrollLeft) * (discoveryRailDotIndexes.length - 1))
    setChipRailPage((current) =>
      current === nextPage ? current : Math.max(0, Math.min(discoveryRailDotIndexes.length - 1, nextPage)),
    )
  }

  function scrollChipRailTo(pageIndex: number) {
    const rail = chipRailRef.current
    if (!rail) return

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth
    rail.scrollTo({
      behavior: 'smooth',
      left: maxScrollLeft <= 0
        ? 0
        : (maxScrollLeft * pageIndex) / (discoveryRailDotIndexes.length - 1),
    })
    setChipRailPage(pageIndex)
  }

  return (
    <section className="discovery-modal plan-discovery-page">
      <div className="plan-hero">
        <div className="plan-hero-copy">
          <span className="plan-kicker">
            <Sparkles size={16} />
            Never Wonder What to Do Today.
          </span>
          <h1>{firstName ? `${firstName}, what's the plan today?` : "What's the plan today?"}</h1>
          <p>Tell us the mood, people and budget. Zumers will find the right plan.</p>
        </div>

        {onClose ? (
          <button className="icon-button quiet plan-close-button" type="button" aria-label="Close search" onClick={onClose}>
            <X size={20} />
          </button>
        ) : null}

        <form className="discovery-search-form" role="search" onSubmit={search}>
          <label aria-label={title}>
            <Search size={21} />
            <div className="discovery-search-composer">
              {selectedChips.map((chip) => (
                <button
                  aria-label={`Remove ${chip}`}
                  className="discovery-search-tag"
                  key={chip}
                  title={`Remove ${chip}`}
                  type="button"
                  onClick={() => toggleChip(chip)}
                >
                  {chip}
                </button>
              ))}
              <input
                autoFocus={autoFocus}
                placeholder="Dinner for 4 near me tonight under Rs 1,000"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>
          <div className={nearbyEnabled ? 'discovery-nearby-row active' : 'discovery-nearby-row'}>
            <button
              type="button"
              aria-pressed={nearbyEnabled}
              disabled={locationBusy}
              onClick={toggleNearbySearch}
            >
              <MapPin size={15} />
              <span>{locationBusy ? 'Locating' : nearbyEnabled ? 'Nearby on' : 'Nearby off'}</span>
            </button>
          </div>
          <button
            className="primary-button plan-search-button"
            disabled={loading || (!query.trim() && selectedChips.length === 0)}
            type="submit"
          >
            <span>{loading ? 'Finding plans' : 'Find a plan'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
        {locationError ? <span className="discovery-location-error">{locationError}</span> : null}

        {heroPreviewItems.length > 0 ? (
          <div className="plan-hero-preview" aria-label="Discovery preview">
            {heroPreviewItems.map((item) => (
              <button key={item.id} type="button" onClick={() => exploreItem(item)}>
                <span>{item.category}</span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="discovery-toolbar">
        <div className="plan-mobile-section-title">
          <h2>Explore</h2>
        </div>
        <div
          className="discovery-chip-row"
          aria-label="Discovery filters"
          ref={chipRailRef}
          onScroll={syncChipRailPage}
        >
          {discoveryServices.map((service) => {
            const Icon = service.icon
            return (
              <button
                className={activeService === service.label ? 'active' : ''}
                key={service.label}
                type="button"
                aria-pressed={activeService === service.label}
                onClick={() => exploreService(service)}
              >
                <span className="discovery-chip-icon">
                  <Icon size={17} />
                </span>
                <span>{service.label}</span>
              </button>
            )
          })}
        </div>
        <div className="plan-rail-dots" aria-label="Explore category pages">
          {discoveryRailDotIndexes.map((pageIndex) => (
            <button
              aria-label={`Show category page ${pageIndex + 1}`}
              className={chipRailPage === pageIndex ? 'active' : ''}
              key={pageIndex}
              type="button"
              onClick={() => scrollChipRailTo(pageIndex)}
            />
          ))}
        </div>
      </div>

      {error ? <div className="inline-error">{error}</div> : null}

      {loading ? <DiscoverySkeletonSection /> : null}

      {!loading && searched && results.length === 0 ? (
        <div className="plan-empty-state">
          <Sparkles size={22} />
          <div>
            <h2>No matching plans found</h2>
            <p>Try a broader location, budget, or mood.</p>
          </div>
        </div>
      ) : null}

      {!loading && results.length > 0 ? (
        <DiscoverySection
          section={{
            id: 'search-results',
            title: 'Best matches for you',
            subtitle: '',
            items: results.map(resultToShowcaseItem),
          }}
          onBack={closeSearchResults}
          onExplore={exploreItem}
        />
      ) : null}

      {showBrowseSections ? (
        <div className="plan-section-stack">
          {showcaseSections.map((section) => (
            <DiscoverySection key={section.id} section={section} onExplore={exploreItem} />
          ))}
        </div>
      ) : null}

      {showBrowseSections ? (
        <RecentSearches
          items={recentSearches.length ? recentSearches : discoveryFallbackSearches}
          isFallback={recentSearches.length === 0}
          onClear={clearRecentSearches}
          onRemove={removeRecentSearch}
          onSelect={selectRecentSearch}
        />
      ) : null}
    </section>
  )
}

function DiscoverySection({
  onBack,
  onExplore,
  section,
}: {
  onBack?: () => void
  onExplore: (item: DiscoveryShowcaseItem) => void
  section: DiscoverySectionData
}) {
  if (section.items.length === 0) return null

  return (
    <section className="plan-discovery-section" aria-labelledby={`${section.id}-title`}>
      <div className="plan-section-heading">
        <div>
          <h2 id={`${section.id}-title`}>{section.title}</h2>
          {section.subtitle ? <p>{section.subtitle}</p> : null}
        </div>
        {section.id === 'search-results' && onBack ? (
          <button className="plan-section-back" type="button" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        ) : (
          <button type="button" onClick={() => onExplore(section.items[0])}>
            See all
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      {section.id === 'search-results' ? (
        <div className="discovery-result-list">
          {section.items.map((item) =>
            item.source ? (
              <DiscoveryResultCard key={item.id} result={item.source} />
            ) : (
              <DiscoveryCard item={item} key={item.id} onExplore={onExplore} />
            ),
          )}
        </div>
      ) : (
        <div className="plan-card-row">
          {section.items.map((item) => (
            <DiscoveryCard item={item} key={item.id} onExplore={onExplore} />
          ))}
        </div>
      )}
    </section>
  )
}

function DiscoveryCard({
  item,
  onExplore,
}: {
  item: DiscoveryShowcaseItem
  onExplore: (item: DiscoveryShowcaseItem) => void
}) {
  const FallbackIcon = discoveryIconForCategory(item.category)
  const cardTone = discoveryToneForCategory(item.category)
  const [saved, setSaved] = useState(() =>
    item.source ? loadDiscoverySavedBusinesses().includes(item.source.business_id) : false,
  )

  function toggleSave(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!item.source) {
      setSaved((current) => !current)
      return
    }
    const next = toggleDiscoverySavedBusiness(item.source.business_id)
    setSaved(next.includes(item.source.business_id))
  }

  return (
    <article className={`plan-discovery-card ${cardTone}`}>
      <button
        className="plan-discovery-card-main"
        type="button"
        onClick={() => onExplore(item)}
      >
        <div className="plan-discovery-card-media">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} loading="lazy" decoding="async" />
          ) : (
            <div className="plan-discovery-card-fallback">
              <FallbackIcon size={38} />
            </div>
          )}
          {item.dateLabel ? <span className="plan-date-badge">{item.dateLabel}</span> : null}
          {item.offer ? <span className="plan-offer-badge">{item.offer}</span> : null}
        </div>
        <div className="plan-discovery-card-body">
          <div>
            <span className="plan-card-category">{item.category}</span>
            <h3>{item.title}</h3>
            <p>{item.businessName}</p>
          </div>
          <div className="plan-card-meta">
            {item.rating ? (
              <span>
                <Star size={14} fill="currentColor" />
                {item.rating.toFixed(1)}
                {item.reviews ? ` (${compactDiscoveryCount(item.reviews)})` : ''}
              </span>
            ) : null}
            {item.distance ? <span>{item.distance}</span> : null}
            {item.price ? <span>{item.price}</span> : null}
          </div>
          <div className="plan-card-footer">
            <span>{item.reason}</span>
            <strong>{item.locality}</strong>
          </div>
        </div>
      </button>
      <button
        aria-label={saved ? 'Saved' : 'Save'}
        className={saved ? 'plan-card-save active' : 'plan-card-save'}
        title={saved ? 'Saved' : 'Save'}
        type="button"
        onClick={toggleSave}
      >
        <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}

function RecentSearches({
  isFallback,
  items,
  onClear,
  onRemove,
  onSelect,
}: {
  isFallback: boolean
  items: string[]
  onClear: () => void
  onRemove: (item: string) => void
  onSelect: (item: string) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="plan-recent-searches" aria-labelledby="recent-searches-title">
      <div className="plan-section-heading compact">
        <div>
          <h2 id="recent-searches-title">Continue exploring</h2>
          <p>{isFallback ? 'Try one of these Zumers searches.' : 'Your recent discovery searches.'}</p>
        </div>
        {!isFallback ? (
          <button type="button" onClick={onClear}>
            Clear all
          </button>
        ) : null}
      </div>
      <div className="plan-recent-row">
        {items.map((item) => (
          <span className="plan-recent-pill" key={item}>
            <button type="button" onClick={() => onSelect(item)}>
              <Search size={15} />
              <span>{item}</span>
            </button>
            {!isFallback ? (
              <button
                aria-label={`Remove ${item}`}
                className="plan-recent-remove"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(item)
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </span>
        ))}
      </div>
    </section>
  )
}

function DiscoverySkeletonSection() {
  return (
    <section className="plan-discovery-section" aria-label="Loading recommendations">
      <div className="plan-section-heading">
        <div>
          <h2>Finding the right plans</h2>
          <p>Checking nearby places, timing, budget, and mood.</p>
        </div>
      </div>
      <div className="plan-card-row">
        {[0, 1, 2].map((item) => (
          <div className="plan-card-skeleton" key={item}>
            <span />
            <strong />
            <p />
          </div>
        ))}
      </div>
    </section>
  )
}

function buildDiscoverySections(results: DiscoverySearchResult[]): DiscoverySectionData[] {
  if (results.length === 0) return discoveryDemoSections

  const mapped = results.map(resultToShowcaseItem)
  const budgetItems = mapped.filter((item) =>
    /budget|under|rs|from/i.test(item.price ?? item.reason),
  )
  const eventItems = mapped.filter((item) =>
    /event|music|comedy|workshop|ticket|show|live/i.test(`${item.category} ${item.reason} ${item.title}`),
  )
  const groupItems = mapped.filter((item) =>
    /group|friends|family|people/i.test(`${item.reason} ${item.title}`),
  )

  return [
    {
      id: 'tonight',
      title: 'In the spotlight',
      subtitle: 'Fresh matches from your latest search.',
      items: mapped.slice(0, 4),
    },
    {
      id: 'trending',
      title: 'Trending near you',
      subtitle: 'Places and activities getting attention nearby.',
      items: mapped.slice(4, 8).length ? mapped.slice(4, 8) : mapped.slice(0, 4),
    },
    {
      id: 'budget',
      title: 'Great plans under your budget',
      subtitle: 'Options that keep spend predictable.',
      items: budgetItems.length ? budgetItems.slice(0, 4) : mapped.slice(0, 4),
    },
    {
      id: 'groups',
      title: 'Perfect for your group',
      subtitle: 'Shortlist-worthy places for friends and family.',
      items: groupItems.length ? groupItems.slice(0, 4) : mapped.slice(0, 4),
    },
    {
      id: 'weekend',
      title: 'Events this weekend',
      subtitle: 'Shows, workshops, and activities to book ahead.',
      items: eventItems.length ? eventItems.slice(0, 4) : mapped.slice(0, 3),
    },
  ].filter((section) => section.items.length > 0)
}

function resultToShowcaseItem(result: DiscoverySearchResult): DiscoveryShowcaseItem {
  const locality = [result.area, result.city].filter(Boolean).join(', ') || result.location
  const price = discoveryPriceLabel(result)
  return {
    id: result.id,
    category: result.subcategory ?? result.category,
    title: result.title,
    businessName: result.business_name,
    locality,
    reason: result.reasons[0] ?? result.best_for ?? (result.open_now ? 'Open now' : 'Worth shortlisting'),
    rating: result.score ? Math.max(3.8, Math.min(4.9, 3.9 + result.score / 250)) : undefined,
    reviews: result.likes_received,
    distance: result.distance_km ? `${result.distance_km} km` : undefined,
    price: price ?? undefined,
    status: result.open_now ? 'Open now' : undefined,
    offer: result.active_offer_title,
    dateLabel: result.next_event_title ? 'Event' : undefined,
    imageUrl: result.image_url,
    source: result,
  }
}

function discoveryIconForCategory(category: string) {
  const normalized = category.toLowerCase()
  const matchedService = discoveryServices.find((service) => {
    const label = service.label.toLowerCase()
    const serviceText = `${label} ${service.query} ${service.chips.join(' ')}`.toLowerCase()
    return serviceText.includes(normalized) || normalized.includes(label)
  })
  if (matchedService) return matchedService.icon
  if (/dining|dinner|restaurant|food|momos|chaat/.test(normalized)) return Utensils
  if (/movie|show|cinema|nightlife/.test(normalized)) return Clapperboard
  if (/event|music|comedy|ticket|workshop/.test(normalized)) return Ticket
  if (/shopping|store|market/.test(normalized)) return ShoppingBag
  if (/play|activity|game|bowling/.test(normalized)) return Dumbbell
  return Sparkles
}

function discoveryToneForCategory(category: string) {
  return /cafe|dining|dinner|restaurant|food|momos|chaat/i.test(category)
    ? 'plan-discovery-card-food'
    : 'plan-discovery-card-color'
}

function firstUserName(user?: User | null) {
  const name = user?.display_name?.trim() || user?.username?.trim()
  if (!name) return ''
  return name.split(/\s+/)[0]
}

function splitLocationLabel(location: string) {
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0 || location === 'Use current location') {
    return {
      primary: 'Use current location',
      secondary: 'Tap to personalize plans',
    }
  }
  return {
    primary: parts[0],
    secondary: parts.slice(1).join(', '),
  }
}

function DiscoveryResultCard({ result }: { result: DiscoverySearchResult }) {
  const { user } = useAuth()
  const price = discoveryPriceLabel(result)
  const duration = result.typical_duration_minutes
    ? `${Math.round(result.typical_duration_minutes / 60 * 10) / 10} hr`
    : null
  const location = [result.area, result.city].filter(Boolean).join(', ') || result.location
  const rating = result.score ? Math.max(3.8, Math.min(4.9, 3.9 + result.score / 250)) : null
  const distance = typeof result.distance_km === 'number' ? `${Math.round(result.distance_km * 10) / 10} km` : null
  const displayTitle = result.business_name || result.title
  const specialitySource = result.subcategory ?? result.category
  const speciality = specialitySource.split(/[,\s/&]+/).find(Boolean) ?? 'Place'
  const costLine = price ? `${speciality} - ${price}` : speciality
  const statusLabel = result.open_now ? 'Open now' : 'Closed now'
  const offerLine = result.active_offer_title ?? result.next_event_title
  const [saved, setSaved] = useState(() => loadDiscoverySavedBusinesses().includes(result.business_id))
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [liked, setLiked] = useState(() => result.liked_by_me ?? false)
  const [likesCount, setLikesCount] = useState(() => result.likes_received ?? 0)
  const [likeBusy, setLikeBusy] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingName, setBookingName] = useState(() => user?.display_name ?? '')
  const [bookingContact, setBookingContact] = useState(() => user?.email ?? '')
  const [bookingTime, setBookingTime] = useState('')
  const [bookingNote, setBookingNote] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!bookingName && user?.display_name) setBookingName(user.display_name)
    if (!bookingContact && user?.email) setBookingContact(user.email)
  }, [bookingContact, bookingName, user?.display_name, user?.email])

  async function toggleLike() {
    if (likeBusy) return
    const previousLiked = liked
    const previousCount = likesCount
    const nextLiked = !previousLiked
    setLikeBusy(true)
    setActionStatus(null)
    setLiked(nextLiked)
    setLikesCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)))
    try {
      const response = previousLiked
        ? await api.removeBusinessLike(result.business_id)
        : await api.likeBusiness(result.business_id)
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

  function shareResult() {
    setActionStatus(null)
    try {
      sessionStorage.setItem(
        pendingBusinessShareKey,
        JSON.stringify(discoverySharePayload(result, price, duration, location)),
      )
      navigate('/chat?share=business')
    } catch {
      setActionStatus('Could not open share')
    }
  }

  function toggleSave() {
    const next = toggleDiscoverySavedBusiness(result.business_id)
    const isSaved = next.includes(result.business_id)
    setSaved(isSaved)
    setActionStatus(isSaved ? 'Saved' : 'Removed')
  }

  function bookResult() {
    setActionStatus(null)
    setBookingOpen((value) => !value)
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const requesterName = bookingName.trim()
    if (!requesterName) {
      setActionStatus('Name is required')
      return
    }

    let bookingTimestamp: string | undefined
    if (bookingTime) {
      const parsed = new Date(bookingTime)
      if (Number.isNaN(parsed.getTime())) {
        setActionStatus('Choose a valid time')
        return
      }
      bookingTimestamp = parsed.toISOString()
    }

    setBookingBusy(true)
    setActionStatus(null)
    try {
      await api.createBusinessBooking(result.business_id, {
        requester_name: requesterName,
        requester_contact: bookingContact.trim() || undefined,
        booking_note: bookingNote.trim() || `Booking request for ${result.title}`,
        booking_time: bookingTimestamp,
      })
      setBookingOpen(false)
      setBookingTime('')
      setBookingNote('')
      setActionStatus('Booking request sent')
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : 'Could not send booking')
    } finally {
      setBookingBusy(false)
    }
  }

  return (
    <article className="discovery-result-card">
      <div className="discovery-result-media">
        {result.image_url ? (
          <img src={result.image_url} alt={displayTitle} loading="lazy" decoding="async" />
        ) : (
          <div className="discovery-result-image">
            <Sparkles size={24} />
          </div>
        )}
        {rating ? (
          <div className="discovery-media-badge">
            <span>{rating.toFixed(1)}</span>
            <Star size={12} fill="currentColor" />
          </div>
        ) : null}
      </div>
      <div className="discovery-result-body">
        <div className="discovery-result-heading">
          <div>
            <h3>{displayTitle}</h3>
          </div>
        </div>
        {distance ? <p className="discovery-distance-line">{distance} from your location</p> : null}
        {location ? <p className="discovery-location-line">{location}</p> : null}
        <p className="discovery-speciality-line">{costLine}</p>
        <p className={result.open_now ? 'discovery-status-line open' : 'discovery-status-line'}>
          {statusLabel}
        </p>
        {offerLine ? (
          <div className="discovery-offer-chip">
            <Tags size={14} />
            <span>{offerLine}</span>
          </div>
        ) : null}
        <div className="discovery-result-footer">
          <button
            type="button"
            className="discovery-action-button discovery-like-button"
            aria-label={liked ? 'Unlike business' : 'Like business'}
            title={liked ? 'Unlike business' : 'Like business'}
            onClick={toggleLike}
            disabled={likeBusy}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            <span>{compactDiscoveryCount(likesCount)}</span>
          </button>
          <button
            type="button"
            className="discovery-action-button"
            aria-label="Book"
            title="Book"
            onClick={bookResult}
          >
            <CalendarCheck size={18} />
            <span>Book</span>
          </button>
          <button
            type="button"
            className="discovery-action-button"
            aria-label="Share"
            title="Share"
            onClick={shareResult}
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>
          <button
            type="button"
            className={`discovery-action-button ${saved ? 'is-saved' : ''}`}
            aria-label={saved ? 'Saved' : 'Save'}
            title={saved ? 'Saved' : 'Save'}
            onClick={toggleSave}
          >
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
        {actionStatus ? <span className="discovery-action-status">{actionStatus}</span> : null}
        {bookingOpen ? (
          <form className="discovery-booking-form" onSubmit={submitBooking}>
            <label>
              <span>Name</span>
              <input
                type="text"
                maxLength={160}
                value={bookingName}
                onChange={(event) => setBookingName(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Contact</span>
              <input
                type="text"
                maxLength={160}
                value={bookingContact}
                onChange={(event) => setBookingContact(event.target.value)}
                placeholder="Phone or email"
              />
            </label>
            <label>
              <span>Preferred time</span>
              <input
                type="datetime-local"
                value={bookingTime}
                onChange={(event) => setBookingTime(event.target.value)}
              />
            </label>
            <label>
              <span>Note</span>
              <textarea
                rows={2}
                value={bookingNote}
                onChange={(event) => setBookingNote(event.target.value)}
                placeholder={`Book ${result.title}`}
              />
            </label>
            <div className="discovery-booking-actions">
              <button type="button" className="ghost-button" onClick={() => setBookingOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={bookingBusy}>
                {bookingBusy ? 'Sending' : 'Send request'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </article>
  )
}

function discoveryPriceLabel(result: DiscoverySearchResult) {
  if (typeof result.average_price_per_person === 'number') {
    return `${Math.round(result.average_price_per_person)}/person`
  }
  if (typeof result.starting_price === 'number') {
    return `from ${Math.round(result.starting_price)}`
  }
  switch (result.price_range) {
    case 'budget':
      return 'Budget'
    case 'moderate':
      return 'Moderate'
    case 'premium':
      return 'Premium'
    case 'luxury':
      return 'Luxury'
    default:
      return null
  }
}

function discoverySharePayload(
  result: DiscoverySearchResult,
  priceLabel: string | null,
  durationLabel: string | null,
  location: string,
) {
  return {
    business_id: result.business_id,
    venue_id: result.venue_id,
    experience_id: result.experience_id,
    title: result.title,
    business_name: result.business_name,
    category: result.category,
    subcategory: result.subcategory,
    location,
    city: result.city,
    area: result.area,
    distance_km: result.distance_km,
    price_label: priceLabel ?? undefined,
    duration_label: durationLabel ?? undefined,
    image_url: result.image_url,
    active_offer_title: result.active_offer_title,
    next_event_title: result.next_event_title,
  }
}

function compactDiscoveryCount(count: number) {
  if (count >= 1000000) return `${Math.round(count / 100000) / 10}M`
  if (count >= 1000) return `${Math.round(count / 100) / 10}K`
  return String(count)
}

function loadDiscoveryRecentSearches() {
  try {
    const parsed = JSON.parse(localStorage.getItem(discoveryRecentSearchesKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, 6)
  } catch {
    return []
  }
}

function saveDiscoveryRecentSearch(query: string) {
  const next = [
    query,
    ...loadDiscoveryRecentSearches().filter((item) => item.toLowerCase() !== query.toLowerCase()),
  ].slice(0, 6)
  localStorage.setItem(discoveryRecentSearchesKey, JSON.stringify(next))
  return next
}

function loadDiscoverySavedBusinesses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(discoverySavedBusinessesKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is number => typeof item === 'number')
  } catch {
    return []
  }
}

function toggleDiscoverySavedBusiness(businessID: number) {
  const savedBusinesses = loadDiscoverySavedBusinesses()
  const exists = savedBusinesses.includes(businessID)
  const next = exists
    ? savedBusinesses.filter((item) => item !== businessID)
    : [businessID, ...savedBusinesses]
  localStorage.setItem(discoverySavedBusinessesKey, JSON.stringify(next))
  return next
}

export function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return <img className="avatar" src={src} alt="" />
  }
  return <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
}

type ContactItem = {
  friend: User
  conversation?: Conversation
  isOnline: boolean
  lastActivity?: string
}

function ContactSection({
  contacts,
  emptyLabel,
  onOpen,
  title,
}: {
  contacts: ContactItem[]
  emptyLabel: string
  onOpen: (friend: User) => void
  title: string
}) {
  return (
    <section className="contact-section">
      <h3>{title}</h3>
      {contacts.length === 0 ? (
        <span className="contact-empty">{emptyLabel}</span>
      ) : null}
      {contacts.map(({ conversation, friend, isOnline, lastActivity }) => (
        <button
          className="chat-contact"
          key={`${title}-${friend.id}`}
          type="button"
          onClick={() => onOpen(friend)}
        >
          <span className="chat-avatar-wrap">
            <Avatar name={friend.display_name} src={friend.avatar_url} />
            <span
              className={
                isOnline ? 'presence-dot online' : 'presence-dot offline'
              }
            />
          </span>
          <span>
            <strong>{friend.display_name}</strong>
            <small>
              {conversationLatestLabel(conversation) ??
                (lastActivity
                  ? `Active ${formatContactTime(lastActivity)}`
                  : `@${friend.username}`)}
            </small>
          </span>
        </button>
      ))}
    </section>
  )
}

function conversationLatestLabel(conversation?: Conversation) {
  const message = conversation?.latest_message
  if (!message) return null
  if (message.message_type === 'business_share') {
    try {
      const parsed = JSON.parse(message.content ?? '{}') as { business_name?: string }
      return parsed.business_name ? `Shared ${parsed.business_name}` : 'Shared a business'
    } catch {
      return 'Shared a business'
    }
  }
  if (message.message_type === 'image') return 'Photo'
  if (message.message_type === 'video') return 'Video'
  return message.content ?? 'Message'
}

function isRecentlyActive(value?: string) {
  if (!value) return false
  return Date.now() - new Date(value).getTime() < 1000 * 60 * 15
}

function dateValue(value?: string) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatContactTime(value: string) {
  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(value).getTime()) / 60000),
  )
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function labelForNotification(type: string) {
  switch (type) {
    case 'friend_request':
      return 'Friend invite'
    case 'friend_accept':
      return 'Friend invite accepted'
    case 'message':
      return 'New message'
    case 'post_reaction':
      return 'Someone is interested'
    case 'post_comment':
      return 'New reply'
    case 'post_share':
      return 'Sent to Feed'
    default:
      return type.replaceAll('_', ' ')
  }
}
