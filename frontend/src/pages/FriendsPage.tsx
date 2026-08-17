import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  MessageCircle,
  Search,
  Settings,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/AppLayout'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { api } from '../lib/api'
import type { FriendRequest, FriendSuggestion, User } from '../lib/types'

type FriendsSection = 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays'
type BirthdayFriend = {
  daysUntil: number
  friend: User
  label: string
  monthDayLabel: string
}

export function FriendsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<FriendsSection>('home')
  const [friends, setFriends] = useState<User[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [friendSuggestions, setFriendSuggestions] = useState<FriendSuggestion[]>([])
  const [results, setResults] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  async function load() {
    const [
      friendResponse,
      requestResponse,
      outgoingResponse,
      suggestionResponse,
    ] = await Promise.all([
      api.friends(),
      api.friendRequests(),
      api.friendRequests('outgoing'),
      api.friendSuggestions(),
    ])
    setFriends(friendResponse.friends)
    setRequests(requestResponse.friend_requests)
    setOutgoing(outgoingResponse.friend_requests)
    setFriendSuggestions(suggestionResponse.suggestions)
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load friends'),
    )
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }, [searchOpen])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      setResults([])
      return
    }
    setError(null)
    try {
      const response = await api.searchUsers(trimmedQuery)
      const friendIDs = new Set(friends.map((friend) => friend.id))
      const incomingIDs = new Set(
        requests
          .filter((request) => request.status === 'pending')
          .map((request) => request.sender_id),
      )
      setResults(
        response.users.filter(
          (person) =>
            person.id !== user?.id &&
            !friendIDs.has(person.id) &&
            !incomingIDs.has(person.id),
        ),
      )
      setActiveSection('suggestions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    }
  }

  async function sendRequest(person: User) {
    setBusyAction(`send-${person.id}`)
    setError(null)
    try {
      await api.sendFriendRequest(person.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Friend request failed')
    } finally {
      setBusyAction(null)
    }
  }

  async function answerRequest(id: number, action: 'accept' | 'reject') {
    setBusyAction(`${action}-${id}`)
    setError(null)
    try {
      if (action === 'accept') {
        await api.acceptFriendRequest(id)
      } else {
        await api.rejectFriendRequest(id)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update request')
    } finally {
      setBusyAction(null)
    }
  }

  async function startChat(friendId: number) {
    setBusyAction(`chat-${friendId}`)
    try {
      await api.createConversation(friendId)
      navigate('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat')
    } finally {
      setBusyAction(null)
    }
  }

  async function unfriend(friendId: number) {
    setBusyAction(`unfriend-${friendId}`)
    setError(null)
    try {
      await api.unfriend(friendId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unfriend')
    } finally {
      setBusyAction(null)
    }
  }

  function openSearch() {
    setSearchOpen(true)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
    setResults([])
    setError(null)
  }

  const suggestedPeople = useMemo(
    () => {
      if (results.length > 0) {
        return results.map((person) => ({ person, reason: undefined }))
      }

      return friendSuggestions.map((suggestion) => ({
        person: suggestion.user,
        reason: suggestion.reason,
      }))
    },
    [friendSuggestions, results],
  )
  const pendingOutgoingReceiverIDs = useMemo(
    () =>
      new Set(
        outgoing
          .filter((request) => request.status === 'pending')
          .map((request) => request.receiver_id),
      ),
    [outgoing],
  )
  const birthdayFriends = useMemo(() => friendsToBirthdays(friends), [friends])
  const todayBirthdayFriends = birthdayFriends.filter((item) => item.daysUntil === 0)
  const upcomingBirthdayFriends = birthdayFriends.filter((item) => item.daysUntil > 0)
  const showHome = activeSection === 'home'

  return (
    <section className="friends-page">
      <aside className="friends-side-panel">
        <div
          className={
            searchOpen
              ? 'friends-side-heading friends-side-heading-searching'
              : 'friends-side-heading'
          }
        >
          <button
            aria-label="Go back"
            className="mobile-friends-back"
            type="button"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={28} />
          </button>
          <h1>Friends</h1>
          <button
            aria-label="Friends settings"
            className="friends-settings-button"
            type="button"
          >
            <Settings size={22} />
          </button>
          <button
            aria-label="Search friends"
            className="mobile-friends-search-button"
            type="button"
            onClick={openSearch}
          >
            <Search size={24} />
          </button>
        </div>
        <form
          className={
            searchOpen
              ? 'friends-side-search friends-side-search-open'
              : 'friends-side-search'
          }
          onSubmit={search}
        >
          <Search size={18} />
          <input
            ref={searchInputRef}
            placeholder="Search Friends"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            aria-label="Close friend search"
            className="friends-search-clear"
            type="button"
            onClick={closeSearch}
          >
            <X size={18} />
          </button>
        </form>
        <div className="friends-mobile-chips" aria-label="Friends filters">
          <button type="button" onClick={() => setActiveSection('suggestions')}>
            Suggestions
          </button>
          <button type="button" onClick={() => setActiveSection('all')}>
            Your friends
          </button>
          <button type="button" onClick={() => setActiveSection('birthdays')}>
            Birthdays
          </button>
        </div>
        <nav className="friends-menu" aria-label="Friends sections">
          <FriendsMenuItem
            active={activeSection === 'home'}
            icon={<Users size={23} />}
            label="Home"
            onClick={() => setActiveSection('home')}
          />
          <FriendsMenuItem
            active={activeSection === 'requests'}
            icon={<UserCheck size={23} />}
            label="Friend requests"
            onClick={() => setActiveSection('requests')}
          />
          <FriendsMenuItem
            active={activeSection === 'suggestions'}
            icon={<UserPlus size={23} />}
            label="Suggestions"
            onClick={() => setActiveSection('suggestions')}
          />
          <FriendsMenuItem
            active={activeSection === 'all'}
            icon={<UserMinus size={23} />}
            label="All friends"
            onClick={() => setActiveSection('all')}
          />
          <FriendsMenuItem
            active={activeSection === 'birthdays'}
            icon={<Gift size={23} />}
            label="Birthdays"
            onClick={() => setActiveSection('birthdays')}
          />
        </nav>
      </aside>

      <main className="friends-main-panel">
        <ErrorBanner message={error} />

        {showHome || activeSection === 'requests' ? (
        <section className="friends-section friend-requests-section">
          <div className="friends-section-heading">
            <h2>Friend Requests ({requests.length})</h2>
            {showHome ? (
              <button type="button" onClick={() => setActiveSection('requests')}>
                See all
              </button>
            ) : null}
          </div>
          {requests.length === 0 ? <EmptyState title="No pending requests" /> : null}
          <div className="friend-card-grid">
            {requests.map((request) => (
              <FriendTile
                key={request.id}
                person={request.sender}
                fallbackName={`User #${request.sender_id}`}
              >
                <button
                  className="primary-button"
                  disabled={busyAction === `accept-${request.id}`}
                  onClick={() => answerRequest(request.id, 'accept')}
                >
                  <Check size={17} />
                  <span>Confirm</span>
                </button>
                <button
                  className="small-button muted"
                  disabled={busyAction === `reject-${request.id}`}
                  onClick={() => answerRequest(request.id, 'reject')}
                >
                  <X size={17} />
                  <span>Delete</span>
                </button>
              </FriendTile>
            ))}
          </div>
        </section>
        ) : null}

        {showHome || activeSection === 'suggestions' ? (
        <section className="friends-section friend-suggestions-section">
          <div className="friends-section-heading">
            <h2>People You May Know</h2>
            {showHome ? (
              <button type="button" onClick={() => setActiveSection('suggestions')}>
                See all
              </button>
            ) : null}
          </div>
          {suggestedPeople.length === 0 ? (
            <EmptyState title="No friend suggestions yet" />
          ) : null}
          <div className="friend-card-grid">
            {suggestedPeople.map(({ person, reason }) => {
              const requestSent = pendingOutgoingReceiverIDs.has(person.id)
              return (
                <FriendTile key={person.id} person={person} sublabel={reason}>
                  <button
                    className={requestSent ? 'small-button muted' : 'primary-button'}
                    disabled={requestSent || busyAction === `send-${person.id}`}
                    onClick={() => {
                      if (!requestSent) sendRequest(person)
                    }}
                  >
                    {requestSent ? <Check size={17} /> : <UserPlus size={17} />}
                    <span>
                      {requestSent
                        ? 'Request sent'
                        : busyAction === `send-${person.id}`
                          ? 'Sending'
                          : 'Add friend'}
                    </span>
                  </button>
                  {!requestSent ? (
                    <button className="small-button muted" type="button">
                      <X size={17} />
                      <span>Remove</span>
                    </button>
                  ) : null}
                </FriendTile>
              )
            })}
          </div>
        </section>
        ) : null}

        {showHome || activeSection === 'all' ? (
        <section className="friends-section all-friends-section">
          <div className="friends-section-heading">
            <h2>All Friends</h2>
            {showHome ? (
              <button type="button" onClick={() => setActiveSection('all')}>
                See all
              </button>
            ) : null}
          </div>
          {friends.length === 0 ? <EmptyState title="No friends yet" /> : null}
          <div className="friend-card-grid">
            {friends.map((friend) => (
              <FriendTile key={friend.id} person={friend}>
                <button
                  className="primary-button"
                  disabled={busyAction === `chat-${friend.id}`}
                  onClick={() => startChat(friend.id)}
                >
                  <MessageCircle size={17} />
                  <span>Message</span>
                </button>
                <button
                  className="small-button muted"
                  disabled={busyAction === `unfriend-${friend.id}`}
                  onClick={() => unfriend(friend.id)}
                >
                  <UserMinus size={17} />
                  <span>Unfriend</span>
                </button>
              </FriendTile>
            ))}
          </div>
        </section>
        ) : null}

        {showHome || activeSection === 'birthdays' ? (
          <section className="friends-section birthdays-section">
            <div className="friends-section-heading">
              <h2>Birthdays</h2>
              {showHome ? (
                <button type="button" onClick={() => setActiveSection('birthdays')}>
                  See all
                </button>
              ) : null}
            </div>
            {birthdayFriends.length === 0 ? (
              <EmptyState title="No friend birthdays to show" />
            ) : null}
            {todayBirthdayFriends.length > 0 ? (
              <BirthdayGroup title="Today" birthdays={todayBirthdayFriends} />
            ) : null}
            {upcomingBirthdayFriends.length > 0 ? (
              <BirthdayGroup
                title={todayBirthdayFriends.length > 0 ? 'Upcoming' : 'All Birthdays'}
                birthdays={showHome ? upcomingBirthdayFriends.slice(0, 6) : upcomingBirthdayFriends}
              />
            ) : null}
          </section>
        ) : null}
      </main>
    </section>
  )
}

function FriendsMenuItem({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={active ? 'active' : ''} type="button" onClick={onClick}>
      <span>{icon}</span>
      <strong>{label}</strong>
      {!active ? <ChevronRight size={22} /> : null}
    </button>
  )
}

function FriendTile({
  children,
  fallbackName,
  person,
  sublabel,
}: {
  children: ReactNode
  fallbackName?: string
  person?: User
  sublabel?: string
}) {
  const name = person?.display_name ?? fallbackName ?? 'User'
  return (
    <article className="friend-tile">
      <div className="friend-tile-photo">
        {person?.avatar_url ? (
          <img src={person.avatar_url} alt="" />
        ) : (
          <Avatar name={name} />
        )}
      </div>
      <div className="friend-tile-body">
        <strong>{name}</strong>
        <span>
          {sublabel ?? (person?.username ? `@${person.username}` : 'Zumers profile')}
        </span>
      </div>
      <div className="friend-tile-actions">{children}</div>
    </article>
  )
}

function BirthdayGroup({
  birthdays,
  title,
}: {
  birthdays: BirthdayFriend[]
  title: string
}) {
  return (
    <div className="birthday-group">
      <h3>{title}</h3>
      <div className="birthday-list">
        {birthdays.map((item) => (
          <article className="birthday-row" key={item.friend.id}>
            <Avatar name={item.friend.display_name} src={item.friend.avatar_url} />
            <div>
              <strong>{item.friend.display_name}</strong>
              <span>{item.monthDayLabel}</span>
            </div>
            <small>{item.label}</small>
          </article>
        ))}
      </div>
    </div>
  )
}

function friendsToBirthdays(friends: User[]) {
  const today = new Date()
  return friends
    .map((friend) => {
      const birthday = birthdayInfo(friend, today)
      return birthday ? { friend, ...birthday } : null
    })
    .filter((birthday): birthday is BirthdayFriend => Boolean(birthday))
    .sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
      return a.friend.display_name.localeCompare(b.friend.display_name)
    })
}

function birthdayInfo(friend: User, today: Date) {
  const parts = parseBirthday(friend.date_of_birth)
  if (!parts) return null

  const nextBirthday = nextBirthdayDate(parts.month, parts.day, today)
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const daysUntil = Math.round(
    (nextBirthday.getTime() - startOfToday.getTime()) / 86400000,
  )
  const monthDayLabel = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
  }).format(nextBirthday)

  return {
    daysUntil,
    label: birthdayTimingLabel(daysUntil),
    monthDayLabel,
  }
}

function parseBirthday(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  return { day, month }
}

function nextBirthdayDate(month: number, day: number, today: Date) {
  let year = today.getFullYear()
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  while (!isValidMonthDay(year, month, day)) {
    year += 1
  }

  let next = new Date(year, month - 1, day)
  if (next < startOfToday) {
    year += 1
    while (!isValidMonthDay(year, month, day)) {
      year += 1
    }
    next = new Date(year, month - 1, day)
  }

  return next
}

function isValidMonthDay(year: number, month: number, day: number) {
  return day <= new Date(year, month, 0).getDate()
}

function birthdayTimingLabel(daysUntil: number) {
  if (daysUntil === 0) return 'Today'
  if (daysUntil === 1) return 'Tomorrow'
  return `In ${daysUntil} days`
}
