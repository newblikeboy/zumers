import {
  Bell,
  Bookmark,
  CalendarCheck,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Heart,
  IndianRupee,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Search,
  Share2,
  Sparkles,
  Tags,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
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
  { to: '/profile', label: 'Profile', icon: UserIcon },
  { to: '/friends', label: 'Friends', icon: Users },
]

const discoveryChips = [
  'Food',
  'Street food',
  'Cafe',
  'Fun',
  'Date',
  'Friends',
  'Family',
  'Open now',
  'Under 1000',
  'Events',
  'Peaceful',
  'Nightlife',
  'Adventure',
  'Sports',
  'Shopping',
  'Wellness',
]

const discoveryRecentSearchesKey = 'zumers.discoveryRecentSearches'
const discoverySavedBusinessesKey = 'zumers.discoverySavedBusinesses'
const pendingBusinessShareKey = 'zumers.pendingBusinessShare'
const discoveryFallbackSearches = [
  'street food under 500',
  'bowling for 4 friends',
  'date cafe tonight',
  'events today nearby',
]

export type DiscoverySearchPreset = {
  autoRun?: boolean
  chips?: string[]
  key: number
  query: string
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isReels = location.pathname.startsWith('/reels')
  const isFriends = location.pathname.startsWith('/friends')
  const isChat = location.pathname.startsWith('/chat')
  const showRightRail = location.pathname === '/feed'
  const [friends, setFriends] = useState<User[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [contactQuery, setContactQuery] = useState('')
  const [chatDockLoading, setChatDockLoading] = useState(false)
  const [chatDockError, setChatDockError] = useState<string | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
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
    setNotificationOpen(false)
    setProfileMenuOpen(false)
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

  const frameClass = [
    'app-frame',
    showRightRail ? 'with-right-rail' : 'content-wide',
    isReels ? 'reels-shell' : '',
    isFriends ? 'friends-shell' : '',
    isChat ? 'chat-page-shell' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={frameClass}>
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-mark">Z</div>
          <strong className="topbar-product-name">Zumers</strong>
        </div>

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
            aria-label="Chat"
            className={({ isActive }) =>
              isActive ? 'topbar-icon active' : 'topbar-icon'
            }
            to="/chat"
          >
            <MessageCircle size={21} />
          </NavLink>
          <div className="notification-anchor">
            <button
              aria-expanded={notificationOpen}
              aria-label="Notifications"
              className={notificationOpen ? 'topbar-icon active' : 'topbar-icon'}
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
            {notificationOpen ? (
              <div className="notification-popover" role="dialog" aria-label="Notifications">
                <div className="notification-popover-header">
                  <h2>Notifications</h2>
                  <button
                    aria-label="Close notifications"
                    className="icon-button quiet"
                    type="button"
                    onClick={() => setNotificationOpen(false)}
                  >
                    <X size={19} />
                  </button>
                </div>
                <div className="notification-tabs" role="tablist" aria-label="Notification filters">
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
                    <div className="notification-empty">No notifications</div>
                  ) : null}
                  {!notificationLoading && friendRequests.length > 0 ? (
                    <section className="notification-group">
                      <div className="notification-group-heading">
                        <h3>New</h3>
                        <NavLink to="/friends">See all</NavLink>
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
                              {' sent you a friend request.'}
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
                        <NavLink to="/notifications">See all</NavLink>
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
            ) : null}
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

      <aside className="sidebar">
        <div className="brand">
          <Avatar name={user?.display_name ?? 'U'} src={user?.avatar_url} />
          <div>
            <strong>{user?.display_name ?? 'Zumers'}</strong>
            <span>@{user?.username}</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
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

        <button className="ghost-button sidebar-action" onClick={logout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="main-area">
        <Outlet />
      </main>

      {showRightRail ? (
        <aside className="right-rail" aria-label="Social activity">
          <section className="right-rail-section desktop-only">
            <div className="right-rail-heading">
              <h2>Friend requests</h2>
              <NavLink to="/friends">See all</NavLink>
            </div>
            <div className="request-preview">
              <Avatar name="F" />
              <div>
                <strong>People you may know</strong>
                <span>Review requests and suggestions</span>
              </div>
            </div>
          </section>

          <section className="right-rail-section desktop-only">
            <div className="right-rail-heading">
              <h2>Birthdays</h2>
            </div>
            <p className="rail-muted">No birthdays today.</p>
          </section>

          <section className="right-rail-section contacts-rail">
            <div className="right-rail-heading">
              <h2>Contacts</h2>
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
                placeholder="Search contacts"
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
              <div className="chat-dock-state">No contacts to show</div>
            ) : null}
            {!chatDockLoading && contacts.length > 0 ? (
              <div className="chat-dock-list">
                <ContactSection
                  contacts={recentContacts}
                  emptyLabel="No recent chats"
                  onOpen={openFriendChat}
                  title="Recent contacts"
                />
                <ContactSection
                  contacts={onlineContacts}
                  emptyLabel="No other online friends"
                  onOpen={openFriendChat}
                  title="Online"
                />
                <ContactSection
                  contacts={offlineContacts}
                  emptyLabel="No other offline friends"
                  onOpen={openFriendChat}
                  title="Offline"
                />
              </div>
            ) : null}
          </section>

        </aside>
      ) : null}
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
  const [query, setQuery] = useState('')
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadDiscoveryRecentSearches())
  const [results, setResults] = useState<DiscoverySearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationBusy, setLocationBusy] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [radiusKm, setRadiusKm] = useState(5)

  useEffect(() => {
    if (!preset) return
    const presetChips = preset.chips ?? []
    setQuery(preset.query)
    setSelectedChips(presetChips)
    setResults([])
    setSearched(false)
    setError(null)
    if (preset.autoRun) {
      void runSearch(preset.query, presetChips)
    }
  }, [preset])

  async function runSearch(searchQuery: string, chips: string[]) {
    const trimmedQuery = searchQuery.trim()
    if (trimmedQuery) {
      setRecentSearches(saveDiscoveryRecentSearch(trimmedQuery))
    }
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const response = await api.discoverySearch({
        query: searchQuery,
        chips,
        latitude: location?.latitude,
        longitude: location?.longitude,
        radiusKm: location ? radiusKm : undefined,
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
    await runSearch(query, selectedChips)
  }

  function toggleChip(chip: string) {
    setSelectedChips((current) =>
      current.includes(chip)
        ? current.filter((item) => item !== chip)
        : [...current, chip],
    )
  }

  function useCurrentLocation() {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser')
      return
    }
    setLocationBusy(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationBusy(false)
      },
      () => {
        setLocationError('Could not read current location')
        setLocationBusy(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <section className="discovery-modal">
      <div className="discovery-header">
        <div>
          <span><Sparkles size={16} /> Zumers</span>
          <h2>{title}</h2>
        </div>
        {onClose ? (
          <button className="icon-button quiet" type="button" aria-label="Close search" onClick={onClose}>
            <X size={20} />
          </button>
        ) : null}
      </div>

      <form className="discovery-search-form" onSubmit={search}>
        <label>
          <Search size={19} />
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
                #{chip}
              </button>
            ))}
            <input
              autoFocus={autoFocus}
              placeholder={
                selectedChips.length
                  ? 'add more detail'
                  : 'momos near me, date tonight, 4 friends under 1000'
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button
            aria-label={location ? 'Location enabled' : 'Use current location'}
            className={
              location ? 'discovery-inline-location active' : 'discovery-inline-location'
            }
            disabled={locationBusy}
            title={location ? 'Location enabled' : locationBusy ? 'Locating' : 'Use location'}
            type="button"
            onClick={useCurrentLocation}
          >
            <MapPin size={17} />
          </button>
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? 'Finding' : 'Go'}
        </button>
      </form>

      <div className={location ? 'discovery-nearby-row active' : 'discovery-nearby-row'}>
        <div>
          <span>{location ? 'Search radius' : 'Tap the Location Pin to Search near you'}</span>
          {location ? (
            <label>
              <input
                max="25"
                min="1"
                step="1"
                type="range"
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
              />
              <strong>{radiusKm} km</strong>
            </label>
          ) : null}
        </div>
      </div>

      <div className="discovery-toolbar">
        <div className="discovery-chip-row" aria-label="Discovery filters">
          {discoveryChips.map((chip) => (
            <button
              className={selectedChips.includes(chip) ? 'active' : ''}
              key={chip}
              type="button"
              onClick={() => toggleChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {locationError ? <div className="inline-error">{locationError}</div> : null}
      {error ? <div className="inline-error">{error}</div> : null}

      <div className="discovery-results">
        {loading ? (
          <div className="discovery-state">Finding plans</div>
        ) : null}
        {!loading && !searched ? (
          <div className="discovery-suggestion-panel">
            <span>{recentSearches.length ? 'Recent' : 'Try'}</span>
            <div className="discovery-suggestions">
              {(recentSearches.length ? recentSearches : discoveryFallbackSearches).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item)
                    setSearched(false)
                  }}
                >
                  <Search size={16} />
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {!loading && searched && results.length === 0 ? (
          <div className="discovery-state">No matching plans found</div>
        ) : null}
        {!loading && results.length > 0 ? (
          <div className="discovery-result-list">
            {results.map((result) => (
              <DiscoveryResultCard key={result.id} result={result} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function DiscoveryResultCard({ result }: { result: DiscoverySearchResult }) {
  const { user } = useAuth()
  const price = discoveryPriceLabel(result)
  const duration = result.typical_duration_minutes
    ? `${Math.round(result.typical_duration_minutes / 60 * 10) / 10} hr`
    : null
  const location = [result.area, result.city].filter(Boolean).join(', ') || result.location
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
          <img src={result.image_url} alt="" />
        ) : (
          <div className="discovery-result-image">
            <Sparkles size={24} />
          </div>
        )}
        <div className="discovery-media-badge">
          {result.result_type === 'experience' ? 'Experience' : 'Place'}
        </div>
      </div>
      <div className="discovery-result-body">
        <div className="discovery-result-heading">
          <div>
            <span>{result.subcategory ?? result.category}</span>
            <h3>{result.title}</h3>
          </div>
          {result.open_now ? <strong>Open</strong> : null}
        </div>
        <div className="discovery-business-line">
          <p>{result.business_name}</p>
          {result.verification_level !== 'unverified' ? <span><Check size={13} /> Verified</span> : null}
        </div>
        {result.description ? <p className="discovery-description">{result.description}</p> : null}
        <div className="discovery-result-meta">
          <span><MapPin size={15} /> {result.distance_km ? `${result.distance_km} km` : location}</span>
          {price ? <span><IndianRupee size={15} /> {price}</span> : null}
          {duration ? <span><Clock size={15} /> {duration}</span> : null}
          <span><Tags size={15} /> {result.booking_required ? 'Booking' : result.walk_in_available ? 'Walk-in' : result.category}</span>
        </div>
        {result.active_offer_title || result.next_event_title ? (
          <div className="discovery-signal-row">
            {result.active_offer_title ? <span>{result.active_offer_title}</span> : null}
            {result.next_event_title ? <span>{result.next_event_title}</span> : null}
          </div>
        ) : null}
        {result.reasons.length > 0 ? (
          <div className="discovery-reasons" aria-label="Why this matched">
            {result.reasons.slice(0, 2).map((reason) => (
              <span key={reason}>{reason}</span>
            ))}
          </div>
        ) : null}
        <div className="discovery-actions">
          <button
            type="button"
            className="discovery-action-button discovery-like-button"
            aria-label={liked ? 'Unlike business' : 'Like business'}
            title={liked ? 'Unlike business' : 'Like business'}
            onClick={toggleLike}
            disabled={likeBusy}
          >
            <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
            <span>{compactDiscoveryCount(likesCount)}</span>
          </button>
          <button
            type="button"
            className="discovery-action-button discovery-action-primary"
            aria-label="Book now"
            title="Book now"
            onClick={bookResult}
          >
            <CalendarCheck size={20} />
          </button>
          <button
            type="button"
            className="discovery-action-button"
            aria-label="Share"
            title="Share"
            onClick={shareResult}
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            className={`discovery-action-button ${saved ? 'is-saved' : ''}`}
            aria-label={saved ? 'Saved' : 'Save'}
            title={saved ? 'Saved' : 'Save'}
            onClick={toggleSave}
          >
            <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
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
      return 'New friend request'
    case 'friend_accept':
      return 'Friend request accepted'
    case 'message':
      return 'New message'
    case 'post_reaction':
      return 'New post reaction'
    case 'post_comment':
      return 'New post comment'
    case 'post_share':
      return 'Post shared'
    default:
      return type.replaceAll('_', ' ')
  }
}
