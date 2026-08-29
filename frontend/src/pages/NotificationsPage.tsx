import { Bell, CalendarCheck, Check, CheckCheck, MessageCircle, Settings, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { api } from '../lib/api'
import type { NotificationItem } from '../lib/types'

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')

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

  async function markAllRead() {
    const unread = items.filter((item) => !item.read_at)
    await Promise.all(unread.map((item) => api.markNotificationRead(item.id)))
    await load()
  }

  const unreadCount = items.filter((item) => !item.read_at).length
  const filteredItems = useMemo(
    () => items.filter((item) => filter === 'All' || notificationBucket(item) === filter),
    [filter, items],
  )
  const groupedItems = groupActivityItems(filteredItems)
  const attentionItems = items.filter((item) => !item.read_at || isPlanningNotification(item)).slice(0, 5)
  const filters = ['All', 'Plans', 'Social', 'Messages', 'Offers']

  return (
    <section className="notifications-hub activity-page">
      <main className="activity-main">
        <header className="activity-header">
          <div>
            <h1>Activity</h1>
          </div>
          <div className="activity-header-actions">
            <button className="small-button muted" type="button">
              <Settings size={16} />
              <span>Settings</span>
            </button>
            <button className="primary-button" disabled={unreadCount === 0} type="button" onClick={markAllRead}>
              <CheckCheck size={17} />
              <span>Mark all read</span>
            </button>
          </div>
        </header>

        <div className="activity-filters" role="tablist" aria-label="Activity filters">
          {filters.map((item) => (
            <button
              aria-selected={filter === item}
              className={filter === item ? 'active' : ''}
              key={item}
              role="tab"
              type="button"
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <ErrorBanner message={error} />
        {filteredItems.length === 0 ? (
          <EmptyState
            actionLabel="Open Friends"
            actionTo="/friends"
            icon={<CheckCheck size={24} />}
            title={items.length === 0 ? 'No activity yet' : 'No activity for this filter'}
          />
        ) : null}

        <div className="activity-timeline">
          {groupedItems.map((group) => (
            <NotificationGroup
              icon={<CalendarCheck size={18} />}
              items={group.items}
              key={group.title}
              onMarkRead={markRead}
              title={group.title}
            />
          ))}
        </div>
      </main>

      {attentionItems.length > 0 ? (
        <aside className="activity-attention-panel">
          <span>Attention</span>
          <h2>{attentionItems.length} updates</h2>
          <div>
            {attentionItems.map((item) => (
              <Link key={item.id} to={routeForNotification(item)}>
                {activityIconFor(item)}
                <span>{labelForNotification(item.notification_type)}</span>
              </Link>
            ))}
          </div>
        </aside>
      ) : null}
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
            className={item.read_at ? 'activity-item read' : 'activity-item'}
            key={item.id}
          >
            <span className="activity-item-icon">{activityIconFor(item)}</span>
            <div>
              <strong>{labelForNotification(item.notification_type)}</strong>
              <small>{new Date(item.created_at).toLocaleString()}</small>
            </div>
            <Link className="notification-route-link" to={routeForNotification(item)}>
              {actionForNotification(item)}
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
      return 'New reply on a plan'
    case 'post_share':
      return 'Sent to Feed'
    default:
      return type.replaceAll('_', ' ')
  }
}

function isPlanningNotification(item: NotificationItem) {
  return ['message', 'post_comment', 'post_share'].includes(item.notification_type)
}

function notificationBucket(item: NotificationItem) {
  if (item.notification_type === 'message') return 'Messages'
  if (item.notification_type === 'friend_request' || item.notification_type === 'friend_accept') return 'Social'
  if (item.notification_type.startsWith('post_')) return 'Plans'
  return 'Offers'
}

function actionForNotification(item: NotificationItem) {
  if (item.notification_type === 'message') return 'Messages'
  if (item.notification_type === 'friend_request' || item.notification_type === 'friend_accept') return 'Friends'
  if (item.notification_type.startsWith('post_')) return 'Feed'
  return 'Review'
}

function activityIconFor(item: NotificationItem) {
  if (item.notification_type === 'message') return <MessageCircle size={17} />
  if (item.notification_type === 'friend_request' || item.notification_type === 'friend_accept') return <Users size={17} />
  if (item.notification_type.startsWith('post_')) return <CalendarCheck size={17} />
  return <Bell size={17} />
}

function groupActivityItems(items: NotificationItem[]) {
  const groups = [
    { title: 'Today', items: [] as NotificationItem[] },
    { title: 'Yesterday', items: [] as NotificationItem[] },
    { title: 'Earlier', items: [] as NotificationItem[] },
  ]
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  items.forEach((item) => {
    const created = new Date(item.created_at)
    const day = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()
    if (day === today) groups[0].items.push(item)
    else if (day === yesterday) groups[1].items.push(item)
    else groups[2].items.push(item)
  })
  return groups.filter((group) => group.items.length > 0)
}

function routeForNotification(item: NotificationItem) {
  if (item.notification_type === 'message') return '/chat'
  if (item.notification_type === 'friend_request' || item.notification_type === 'friend_accept') return '/friends'
  if (item.notification_type.startsWith('post_')) return '/feed'
  return '/'
}
