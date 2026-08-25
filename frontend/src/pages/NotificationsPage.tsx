import { Bell, CalendarCheck, Check, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { api } from '../lib/api'
import type { NotificationItem } from '../lib/types'

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const response = await api.notifications()
    setItems(response.notifications)
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load alerts'),
    )
  }, [])

  async function markRead(id: number) {
    await api.markNotificationRead(id)
    await load()
  }

  const unreadCount = items.filter((item) => !item.read_at).length
  const planningItems = items.filter(isPlanningNotification)
  const socialItems = items.filter((item) => !isPlanningNotification(item))
  const messageCount = items.filter((item) => item.notification_type === 'message').length

  return (
    <section className="notifications-hub">
      <header className="section-hero">
        <div>
          <span>Activity</span>
          <h1>Notifications</h1>
        </div>
        <div className="metric-strip">
          <Metric value={items.length} label="Total" />
          <Metric value={unreadCount} label="Unread" />
          <Metric value={messageCount} label="Messages" />
        </div>
      </header>

      <ErrorBanner message={error} />
      <section className="panel notification-panel">
        <div className="panel-title-row">
          <div>
            <h2>Recent activity</h2>
            <span>Messages, friends, comments, and shares.</span>
          </div>
          <Bell size={20} />
        </div>
        {items.length === 0 ? (
          <EmptyState
            actionLabel="Find friends"
            actionTo="/friends"
            description="New requests, messages, comments, and reactions will appear here."
            icon={<CheckCheck size={24} />}
            title="No notifications"
          />
        ) : null}
        <div className="notification-grouped-list">
          <NotificationGroup
            icon={<CalendarCheck size={18} />}
            items={planningItems}
            onMarkRead={markRead}
            title="Planning"
          />
          <NotificationGroup
            icon={<Bell size={18} />}
            items={socialItems}
            onMarkRead={markRead}
            title="Social"
          />
        </div>
      </section>
    </section>
  )
}

function NotificationGroup({
  icon,
  items,
  onMarkRead,
  title,
}: {
  icon: ReactNode
  items: NotificationItem[]
  onMarkRead: (id: number) => void
  title: string
}) {
  if (items.length === 0) return null

  return (
    <section className="notification-page-group">
      <div className="notification-page-group-heading">
        <span>{icon}</span>
        <strong>{title}</strong>
        <small>{items.length}</small>
      </div>
      <div className="notification-list">
        {items.map((item) => (
          <article
            className={item.read_at ? 'notification read' : 'notification'}
            key={item.id}
          >
            <div>
              <strong>{labelForNotification(item.notification_type)}</strong>
              <span>{new Date(item.created_at).toLocaleString()}</span>
            </div>
            <Link className="notification-route-link" to={routeForNotification(item)}>
              Open
            </Link>
            {!item.read_at ? (
              <button
                aria-label="Mark notification as read"
                className="icon-button"
                title="Mark read"
                onClick={() => onMarkRead(item.id)}
              >
                <Check size={18} />
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
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

function isPlanningNotification(item: NotificationItem) {
  return ['message', 'post_comment', 'post_share'].includes(item.notification_type)
}

function routeForNotification(item: NotificationItem) {
  if (item.notification_type === 'message') return '/chat'
  if (item.notification_type === 'friend_request' || item.notification_type === 'friend_accept') return '/friends'
  if (item.notification_type.startsWith('post_')) return '/feed'
  return '/'
}
