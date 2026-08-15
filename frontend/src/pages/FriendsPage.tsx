import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  List,
  MessageCircle,
  Search,
  Settings,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/AppLayout'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { api } from '../lib/api'
import type { FriendRequest, User } from '../lib/types'

export function FriendsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [friends, setFriends] = useState<User[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [results, setResults] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [friendResponse, requestResponse, outgoingResponse] = await Promise.all([
      api.friends(),
      api.friendRequests(),
      api.friendRequests('outgoing'),
    ])
    setFriends(friendResponse.friends)
    setRequests(requestResponse.friend_requests)
    setOutgoing(outgoingResponse.friend_requests)
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load friends'),
    )
  }, [])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (query.trim().length < 2) return
    setError(null)
    try {
      const response = await api.searchUsers(query)
      const friendIDs = new Set(friends.map((friend) => friend.id))
      const outgoingIDs = new Set(
        outgoing
          .filter((request) => request.status === 'pending')
          .map((request) => request.receiver_id),
      )
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
            !outgoingIDs.has(person.id) &&
            !incomingIDs.has(person.id),
        ),
      )
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
      setResults((current) => current.filter((item) => item.id !== person.id))
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

  const suggestions = useMemo(
    () =>
      results.length > 0
        ? results
        : [...outgoing.map((request) => request.receiver).filter(Boolean)] as User[],
    [outgoing, results],
  )

  return (
    <section className="friends-page">
      <aside className="friends-side-panel">
        <div className="friends-side-heading">
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
          >
            <Search size={24} />
          </button>
        </div>
        <form className="friends-side-search" onSubmit={search}>
          <Search size={18} />
          <input
            placeholder="Search Friends"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <div className="friends-mobile-chips" aria-label="Friends filters">
          <button type="button">Suggestions</button>
          <button type="button">Your friends</button>
        </div>
        <nav className="friends-menu" aria-label="Friends sections">
          <FriendsMenuItem active icon={<Users size={23} />} label="Home" />
          <FriendsMenuItem icon={<UserCheck size={23} />} label="Friend requests" />
          <FriendsMenuItem icon={<UserPlus size={23} />} label="Suggestions" />
          <FriendsMenuItem icon={<UserMinus size={23} />} label="All friends" />
          <FriendsMenuItem icon={<Gift size={23} />} label="Birthdays" />
          <FriendsMenuItem icon={<List size={23} />} label="Custom lists" />
        </nav>
      </aside>

      <main className="friends-main-panel">
        <ErrorBanner message={error} />

        <section className="friends-section friend-requests-section">
          <div className="friends-section-heading">
            <h2>Friend Requests ({requests.length})</h2>
            <button type="button">See all</button>
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

        <section className="friends-section friend-suggestions-section">
          <div className="friends-section-heading">
            <h2>People You May Know</h2>
            <button type="button">See all</button>
          </div>
          {suggestions.length === 0 ? (
            <EmptyState title="Search to find friend suggestions" />
          ) : null}
          <div className="friend-card-grid">
            {suggestions.map((person) => (
              <FriendTile key={person.id} person={person}>
                <button
                  className="primary-button"
                  disabled={busyAction === `send-${person.id}`}
                  onClick={() => sendRequest(person)}
                >
                  <UserPlus size={17} />
                  <span>
                    {busyAction === `send-${person.id}` ? 'Sending' : 'Add friend'}
                  </span>
                </button>
                <button className="small-button muted" type="button">
                  <X size={17} />
                  <span>Remove</span>
                </button>
              </FriendTile>
            ))}
          </div>
        </section>

        <section className="friends-section all-friends-section">
          <div className="friends-section-heading">
            <h2>All Friends</h2>
            <button type="button">See all</button>
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
      </main>
    </section>
  )
}

function FriendsMenuItem({
  active,
  icon,
  label,
}: {
  active?: boolean
  icon: ReactNode
  label: string
}) {
  return (
    <button className={active ? 'active' : ''} type="button">
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
}: {
  children: ReactNode
  fallbackName?: string
  person?: User
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
          {person?.username ? `@${person.username}` : 'Zumers profile'}
        </span>
      </div>
      <div className="friend-tile-actions">{children}</div>
    </article>
  )
}
