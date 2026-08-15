import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type EmptyStateProps = {
  title: string
  description?: string
  actionLabel?: string
  actionTo?: string
  icon?: ReactNode
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  icon,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-state-icon">{icon}</div> : null}
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {actionLabel && actionTo ? (
        <Link className="small-button" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
