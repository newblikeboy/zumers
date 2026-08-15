import { Bell, Check, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
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
          <Metric value={items.length - unreadCount} label="Read" />
        </div>
      </header>

      <ErrorBanner message={error} />
      <section className="panel notification-panel">
        <div className="panel-title-row">
          <div>
            <h2>Recent activity</h2>
            <span>Friend, message, and post updates.</span>
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
              {!item.read_at ? (
                <button
                  aria-label="Mark notification as read"
                  className="icon-button"
                  title="Mark read"
                  onClick={() => markRead(item.id)}
                >
                  <Check size={18} />
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
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
