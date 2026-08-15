import {
  Bell,
  Check,
  ChevronDown,
  Clapperboard,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Search,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import type { Conversation, FriendRequest, NotificationItem, User } from '../lib/types'

const navItems = [
  { to: '/', label: 'Feed', icon: Newspaper },
  { to: '/reels', label: 'Reels', icon: Clapperboard },
  { to: '/profile', label: 'Profile', icon: UserIcon },
  { to: '/friends', label: 'Friends', icon: Users },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isReels = location.pathname.startsWith('/reels')
  const isFriends = location.pathname.startsWith('/friends')
  const isChat = location.pathname.startsWith('/chat')
  const showRightRail = location.pathname === '/'
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
      conversationByUser.set(conversation.other_user.id, conversation)
    })

    const byID = new Map<number, User>()
    friends.forEach((friend) => byID.set(friend.id, friend))
    conversations.forEach((conversation) => {
      byID.set(conversation.other_user.id, conversation.other_user)
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
          <NavLink
            aria-label="Open people search"
            className="search-pill search-link"
            to="/friends"
          >
            <Search size={18} />
            <span>Search Zumers</span>
          </NavLink>
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
              {conversation?.latest_message?.content ??
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
