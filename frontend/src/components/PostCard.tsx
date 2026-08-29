import {
  CalendarCheck,
  Globe2,
  Heart,
  LockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { cloudinaryDeliveryUrl } from '../lib/cloudinary'
import type { Comment, Post, PostMedia } from '../lib/types'
import { Avatar } from './AppLayout'

const reactions = [
  { type: 'like', label: 'Like' },
  { type: 'love', label: 'Love' },
  { type: 'care', label: 'Care' },
  { type: 'haha', label: 'Haha' },
  { type: 'wow', label: 'Wow' },
  { type: 'sad', label: 'Sad' },
  { type: 'angry', label: 'Angry' },
]

export function PostCard({
  post,
  onDelete,
  onPostChange,
}: {
  post: Post
  onDelete?: (id: number) => void
  onPostChange?: (post: Post) => void
}) {
  const { user } = useAuth()
  const media = post.media ?? []
  const authorName = post.author?.display_name ?? `User #${post.author_id}`
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [reactionDockOpen, setReactionDockOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const timestamp = useMemo(() => formatRelativeTime(post.created_at), [post.created_at])
  const pulseType = classifyPulsePost(post)

  useEffect(() => {
    if (!commentsOpen) return
    setCommentsLoading(true)
    api
      .comments(post.id)
      .then((response) => setComments(response.comments))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load comments'),
      )
      .finally(() => setCommentsLoading(false))
  }, [commentsOpen, post.id])

  async function toggleLike() {
    if (busy) return
    if (post.viewer_reaction) {
      await clearReaction()
      return
    }
    await setReaction('like')
  }

  async function setReaction(reactionType: string) {
    if (busy) return
    const previousPost = post
    setBusy(true)
    setError(null)
    setReactionDockOpen(false)
    onPostChange?.(optimisticPostReaction(post, reactionType))
    try {
      const updated = await api.reactToPost(post.id, reactionType)
      onPostChange?.(updated)
    } catch (err) {
      onPostChange?.(previousPost)
      setError(err instanceof Error ? err.message : 'Could not update reaction')
    } finally {
      setBusy(false)
    }
  }

  async function clearReaction() {
    const previousPost = post
    setBusy(true)
    setError(null)
    onPostChange?.(optimisticPostReaction(post, undefined))
    try {
      const updated = await api.removePostReaction(post.id)
      onPostChange?.(updated)
    } catch (err) {
      onPostChange?.(previousPost)
      setError(err instanceof Error ? err.message : 'Could not update reaction')
    } finally {
      setBusy(false)
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const content = String(form.get('comment') ?? '').trim()
    if (!content) return
    setCommentBusy(true)
    setError(null)
    try {
      const created = await api.createComment(post.id, content)
      setComments((current) => [...current, created])
      onPostChange?.({ ...post, comment_count: post.comment_count + 1 })
      formElement.reset()
      setCommentsOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add comment')
    } finally {
      setCommentBusy(false)
    }
  }

  async function deleteComment(commentID: number) {
    setError(null)
    try {
      await api.deleteComment(commentID)
      setComments((current) => current.filter((comment) => comment.id !== commentID))
      onPostChange?.({
        ...post,
        comment_count: Math.max(0, post.comment_count - 1),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete comment')
    }
  }

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const content = String(form.get('share_content') ?? '').trim()
    const visibility = String(form.get('share_visibility') ?? 'friends') as
      | 'public'
      | 'friends'
      | 'private'
    setShareBusy(true)
    setError(null)
    try {
      const shared = await api.sharePost(post.id, {
        content: content || undefined,
        visibility,
      })
      onPostChange?.({ ...post, share_count: post.share_count + 1 })
      onPostChange?.(shared)
      setShareOpen(false)
      formElement.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share post')
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <article className="post-card">
      <header className="post-header">
        <Avatar name={authorName} src={post.author?.avatar_url} />
        <div className="post-author">
          <strong>{authorName}</strong>
          <span>
            {timestamp}
            <VisibilityIcon visibility={post.visibility} />
            {visibilityLabel(post.visibility)}
          </span>
        </div>
        <span className={`pulse-type-badge ${pulseType.tone}`}>{pulseType.label}</span>
        {user?.id === post.author_id && onDelete ? (
          <button
            className="icon-button quiet"
            title="Delete post"
            onClick={() => onDelete(post.id)}
          >
            <Trash2 size={17} />
          </button>
        ) : (
          <button className="icon-button quiet" title="Post menu">
            <MoreHorizontal size={18} />
          </button>
        )}
      </header>

      <div className="plan-ribbon" aria-label="Plan context">
        <span><CalendarCheck size={14} /> Plan</span>
        <span><Users size={14} /> {visibilityLabel(post.visibility)}</span>
      </div>

      {post.content ? <p className="post-copy">{post.content}</p> : null}

      {post.shared_post ? <SharedPostPreview post={post.shared_post} /> : null}

      <MediaGrid media={media} />

      {error ? <div className="inline-error">{error}</div> : null}

      <div className="engagement-actions">
        <div
          className="reaction-zone"
          onMouseEnter={() => setReactionDockOpen(true)}
          onMouseLeave={() => setReactionDockOpen(false)}
        >
          {reactionDockOpen ? (
            <div className="reaction-dock">
              {reactions.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setReaction(item.type)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            className={
              post.viewer_reaction ? 'engagement-button active' : 'engagement-button'
            }
            disabled={busy}
            onClick={toggleLike}
            aria-label={post.viewer_reaction ? 'Remove interest' : 'Show interest'}
            title={post.viewer_reaction ? 'Remove interest' : 'Show interest'}
          >
            <Heart size={20} fill={post.viewer_reaction ? 'currentColor' : 'none'} />
            <span>Like</span>
            <strong className="engagement-count">{post.like_count}</strong>
          </button>
        </div>
        <button
          className="engagement-button"
          onClick={() => setCommentsOpen((value) => !value)}
        >
          <MessageCircle size={19} />
          <span>Discuss</span>
          <strong className="engagement-count">{post.comment_count}</strong>
        </button>
        <button
          className="engagement-button"
          onClick={() => setShareOpen((value) => !value)}
        >
          <Repeat2 size={19} />
          <span>Send</span>
          <strong className="engagement-count">{post.share_count}</strong>
        </button>
      </div>

      {commentsOpen ? (
        <div className="comments-area">
          {commentsLoading ? <span className="subtle-line">Loading comments</span> : null}
          {comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <Avatar
                name={comment.author?.display_name ?? `User #${comment.author_id}`}
                src={comment.author?.avatar_url}
              />
              <div className="comment-bubble">
                <strong>
                  {comment.author?.display_name ?? `User #${comment.author_id}`}
                </strong>
                <span>{comment.content}</span>
                <small>{formatRelativeTime(comment.created_at)}</small>
              </div>
              {comment.author_id === user?.id ? (
                <button
                  className="comment-delete"
                  title="Delete comment"
                  onClick={() => deleteComment(comment.id)}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ))}
          <form className="comment-form" onSubmit={addComment}>
            <Avatar name={user?.display_name ?? 'U'} src={user?.avatar_url} />
            <input name="comment" placeholder="Write a comment" />
            <button className="icon-button" disabled={commentBusy} title="Send comment">
              <Send size={17} />
            </button>
          </form>
        </div>
      ) : null}

      {shareOpen ? (
        <div className="share-panel">
          <div className="share-panel-header">
            <strong>Send to a circle</strong>
            <button
              className="icon-button quiet"
              title="Close share"
              onClick={() => setShareOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <form className="share-form" onSubmit={share}>
            <textarea
              name="share_content"
              placeholder="Add a note"
            />
            <SharedPostPreview post={post} compact />
            <div className="composer-controls">
              <select name="share_visibility" defaultValue="friends">
                <option value="friends">Friends</option>
                <option value="public">Public</option>
                <option value="private">Only me</option>
              </select>
              <button className="primary-button" disabled={shareBusy}>
                <Repeat2 size={18} />
                <span>{shareBusy ? 'Sending' : 'Send'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </article>
  )
}

function SharedPostPreview({ post, compact = false }: { post: Post; compact?: boolean }) {
  const authorName = post.author?.display_name ?? `User #${post.author_id}`
  return (
    <div className={compact ? 'shared-post compact' : 'shared-post'}>
      <div className="shared-post-header">
        <Avatar name={authorName} src={post.author?.avatar_url} />
        <div>
          <strong>{authorName}</strong>
          <span>{compact ? 'Post preview' : 'Original post'}</span>
        </div>
      </div>
      {post.content ? <p>{post.content}</p> : null}
      <MediaGrid media={post.media ?? []} compact />
    </div>
  )
}

function optimisticPostReaction(post: Post, reactionType?: string): Post {
  const hadReaction = Boolean(post.viewer_reaction)
  const nextCount = reactionType
    ? post.like_count + (hadReaction ? 0 : 1)
    : Math.max(0, post.like_count - (hadReaction ? 1 : 0))

  return {
    ...post,
    like_count: nextCount,
    viewer_reaction: reactionType,
  }
}

function MediaGrid({ media, compact = false }: { media: PostMedia[]; compact?: boolean }) {
  if (media.length === 0) return null
  return (
    <div
      className={[
        media.length === 1 ? 'media-grid single' : 'media-grid',
        compact ? 'compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {media.map((item) =>
        item.media_type === 'video' ? (
          <video
            key={item.id}
            controls={!compact}
            muted={compact}
            playsInline
            preload="metadata"
            poster={item.thumbnail_url}
            src={cloudinaryDeliveryUrl(item.media_type, item.secure_url)}
          />
        ) : (
          <img
            key={item.id}
            src={cloudinaryDeliveryUrl(item.media_type, item.secure_url)}
            alt=""
          />
        ),
      )}
    </div>
  )
}

function VisibilityIcon({ visibility }: { visibility: Post['visibility'] }) {
  const Icon =
    visibility === 'public' ? Globe2 : visibility === 'private' ? LockKeyhole : Users
  return <Icon size={12} />
}

function visibilityLabel(visibility: Post['visibility']) {
  if (visibility === 'public') return 'Public'
  if (visibility === 'private') return 'Only me'
  return 'Friends'
}

function classifyPulsePost(post: Post) {
  const text = [post.content, post.shared_post?.content].filter(Boolean).join(' ').toLowerCase()
  const hasVideo = (post.media ?? []).some((item) => item.media_type === 'video')
  const hasMedia = (post.media ?? []).length > 0
  if (text.includes('vote') || text.includes('poll')) {
    return { label: 'Poll', tone: 'voting' }
  }
  if (text.includes('event') || text.includes('show') || text.includes('ticket')) {
    return { label: 'Event', tone: 'event' }
  }
  if (text.includes('place') || text.includes('cafe') || text.includes('food') || text.includes('restaurant')) {
    return { label: 'Place', tone: 'place' }
  }
  if (hasVideo) {
    return { label: 'Spot', tone: 'spot' }
  }
  if (hasMedia) {
    return { label: 'Moment', tone: 'moment' }
  }
  return { label: 'Plan', tone: 'idea' }
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ]
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, amount] of divisions) {
    if (Math.abs(seconds) >= amount) {
      return formatter.format(Math.round(seconds / amount), unit)
    }
  }
  return 'Just now'
}
