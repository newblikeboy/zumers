import {
  BadgePlus,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Repeat2,
  Send,
  Star,
  UserCircle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/AppLayout'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { api } from '../lib/api'
import { cloudinaryDeliveryUrl } from '../lib/cloudinary'
import type { Comment, Post } from '../lib/types'

const reelsCachePrefix = 'zumers.reels.'
const reelFilters = [
  { value: 'all', label: 'For you', icon: Star },
  { value: 'planning', label: 'Moves', icon: BadgePlus },
  { value: 'mine', label: 'Mine', icon: UserCircle },
] as const

type ReelFilter = (typeof reelFilters)[number]['value']

function readCachedReels(userID?: number) {
  if (!userID) return null

  try {
    const cached = sessionStorage.getItem(`${reelsCachePrefix}${userID}`)
    if (!cached) return null
    const parsed = JSON.parse(cached) as { posts?: Post[] }
    return Array.isArray(parsed.posts) ? parsed.posts : null
  } catch {
    return null
  }
}

function writeCachedReels(userID: number | undefined, posts: Post[]) {
  if (!userID) return

  try {
    sessionStorage.setItem(
      `${reelsCachePrefix}${userID}`,
      JSON.stringify({ posts }),
    )
  } catch {
    // Cache failure should never block reels.
  }
}

export function ReelsPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeReelID, setActiveReelID] = useState<string | null>(null)
  const [isMobileReels, setIsMobileReels] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 760px)').matches
      : false,
  )
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [commentsPost, setCommentsPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [sharePost, setSharePost] = useState<Post | null>(null)
  const [shareDraft, setShareDraft] = useState('')
  const [activeReelFilter, setActiveReelFilter] = useState<ReelFilter>('all')
  const [reactionBusyIDs, setReactionBusyIDs] = useState<Set<number>>(() => new Set())
  const videoRefs = useRef(new Map<string, HTMLVideoElement>())

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const cachedPosts = readCachedReels(user.id)
    if (cachedPosts) {
      setPosts(cachedPosts)
    }
    setLoading(!cachedPosts)
    setError(null)

    api
      .reels()
      .then((response) => {
        if (cancelled) return
        setPosts(response.posts)
        writeCachedReels(user.id, response.posts)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load reels')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)')
    const update = () => setIsMobileReels(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const allReels = useMemo(
    () =>
      posts.flatMap((post) =>
        reelSourcePosts(post).flatMap((sourcePost) =>
          (sourcePost.media ?? [])
          .filter((media) => media.media_type === 'video')
          .map((media) => ({
            id: `${sourcePost.id}-${media.id}`,
            post: sourcePost,
            media,
          })),
        ),
      ),
    [posts],
  )
  const reels = useMemo(
    () =>
      allReels.filter((reel) => {
        if (activeReelFilter === 'planning') return isPlanningReelPost(reel.post)
        if (activeReelFilter === 'mine') return reel.post.author_id === user?.id
        return true
      }),
    [activeReelFilter, allReels, user?.id],
  )

  useEffect(() => {
    if (reels.length === 0) {
      setActiveReelID(null)
      return
    }
    if (!activeReelID || !reels.some((reel) => reel.id === activeReelID)) {
      setActiveReelID(reels[0].id)
    }
  }, [activeReelID, reels])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const id = visible.target.getAttribute('data-reel-id')
        if (id) {
          setActiveReelID(id)
          setPaused(false)
        }
      },
      { threshold: [0.65, 0.85] },
    )

    const elements = [...document.querySelectorAll('[data-reel-id]')]
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [reels])

  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      video.muted = muted
      if (id === activeReelID && !paused) {
        video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    })
  }, [activeReelID, muted, paused, reels])

  function registerVideo(id: string, node: HTMLVideoElement | null) {
    if (node) {
      videoRefs.current.set(id, node)
    } else {
      videoRefs.current.delete(id)
    }
  }

  function updatePost(updated: Post) {
    setPosts((current) => {
      const next = current.map((post) => replacePost(post, updated))
      writeCachedReels(user?.id, next)
      return next
    })
    setCommentsPost((current) =>
      current?.id === updated.id ? { ...current, ...updated } : current,
    )
  }

  async function toggleReaction(post: Post) {
    if (reactionBusyIDs.has(post.id)) return
    const optimistic = optimisticPostReaction(post, post.viewer_reaction ? undefined : 'like')
    updatePost(optimistic)
    setReactionBusyIDs((current) => new Set(current).add(post.id))
    setError(null)
    try {
      const updated = post.viewer_reaction
        ? await api.removePostReaction(post.id)
        : await api.reactToPost(post.id)
      updatePost(updated)
    } catch (err) {
      updatePost(post)
      setError(err instanceof Error ? err.message : 'Could not update reaction')
    } finally {
      setReactionBusyIDs((current) => {
        const next = new Set(current)
        next.delete(post.id)
        return next
      })
    }
  }

  async function openComments(post: Post) {
    setCommentsPost(post)
    setCommentsLoading(true)
    setError(null)
    try {
      const response = await api.comments(post.id)
      setComments(response.comments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load comments')
    } finally {
      setCommentsLoading(false)
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!commentsPost) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const content = String(form.get('comment') ?? '').trim()
    if (!content) return
    setError(null)
    try {
      const created = await api.createComment(commentsPost.id, content)
      setComments((current) => [...current, created])
      const updated = {
        ...commentsPost,
        comment_count: commentsPost.comment_count + 1,
      }
      updatePost(updated)
      setCommentsPost(updated)
      formElement.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add comment')
    }
  }

  async function submitShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sharePost) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const content = String(form.get('share_content') ?? '').trim()
    setError(null)
    try {
      const shared = await api.sharePost(sharePost.id, {
        content: content || undefined,
        visibility: 'friends',
      })
      updatePost({ ...sharePost, share_count: sharePost.share_count + 1 })
      setPosts((current) => {
        const next = [shared, ...current]
        writeCachedReels(user?.id, next)
        return next
      })
      setSharePost(null)
      setShareDraft('')
      formElement.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share reel')
    }
  }

  const drawerOpen = Boolean(commentsPost || sharePost)
  const activeReelIndex = Math.max(
    0,
    reels.findIndex((reel) => reel.id === activeReelID),
  )
  const activeReel = reels[activeReelIndex] ?? reels[0]
  const planningReelCount = allReels.filter((reel) => isPlanningReelPost(reel.post)).length
  const myReelCount = allReels.filter((reel) => reel.post.author_id === user?.id).length

  function scrollToReel(index: number) {
    const reel = reels[index]
    if (!reel) return
    setActiveReelID(reel.id)
    setPaused(false)
  }

  function openShare(post: Post, draft = '') {
    setShareDraft(draft)
    setSharePost(post)
  }

  function reelFilterCount(filter: ReelFilter) {
    if (filter === 'planning') return planningReelCount
    if (filter === 'mine') return myReelCount
    return allReels.length
  }

  return (
    <section className={drawerOpen ? 'reels-page has-drawer' : 'reels-page'}>
      <aside className="reels-nav">
        <h1>Reels</h1>
        <nav aria-label="Reels navigation">
          {reelFilters.map((filter) => {
            const Icon = filter.icon
            return (
              <button
                className={activeReelFilter === filter.value ? 'reels-nav-item active' : 'reels-nav-item'}
                key={filter.value}
                type="button"
                onClick={() => setActiveReelFilter(filter.value)}
              >
                <Icon size={23} />
                <span>{filter.label}</span>
                <strong>{reelFilterCount(filter.value)}</strong>
              </button>
            )
          })}
        </nav>
      </aside>

        <div className="reels-stage">
        <ErrorBanner message={error} />
        <div className="reels-mobile-filter-bar" aria-label="Reel filters">
          {reelFilters.map((filter) => {
            const Icon = filter.icon
            return (
              <button
                className={activeReelFilter === filter.value ? 'active' : ''}
                key={filter.value}
                type="button"
                onClick={() => setActiveReelFilter(filter.value)}
              >
                <Icon size={15} />
                <span>{filter.label}</span>
              </button>
            )
          })}
        </div>
        {loading && reels.length === 0 ? <ReelsSkeleton /> : null}
        {!loading && reels.length === 0 ? (
          <EmptyState title={activeReelFilter === 'all' ? 'No reels yet. Upload a video post to create one.' : 'No matching reels'} />
        ) : null}

        <div className="reel-stack">
          {(isMobileReels ? reels : activeReel ? [activeReel] : []).map((reel) => (
            <article
              className="reel-card"
              data-reel-id={reel.id}
              key={reel.id}
            >
              <video
                loop
                playsInline
                poster={reel.media.thumbnail_url}
                preload={activeReelID === reel.id ? 'auto' : 'metadata'}
                ref={(node) => registerVideo(reel.id, node)}
                src={cloudinaryDeliveryUrl(reel.media.media_type, reel.media.secure_url)}
                onClick={() => setPaused((value) => !value)}
              />

              <div className="reel-topbar">
                <button
                  className="reel-icon-button"
                  title={muted ? 'Unmute' : 'Mute'}
                  onClick={() => setMuted((value) => !value)}
                >
                  {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
                </button>
              </div>

              <div className="reel-play-state">
                {activeReelID === reel.id && paused ? (
                  <Play size={44} />
                ) : activeReelID === reel.id ? (
                  <Pause size={38} />
                ) : null}
              </div>

              <div className="reel-caption">
                <div className="reel-author">
                  <Avatar
                    name={reel.post.author?.display_name ?? `User #${reel.post.author_id}`}
                    src={reel.post.author?.avatar_url}
                  />
                  <div>
                    <strong>
                      {reel.post.author?.display_name ?? `User #${reel.post.author_id}`}
                    </strong>
                    <span>@{reel.post.author?.username ?? reel.post.author_id}</span>
                  </div>
                </div>
                {reel.post.content ? <p>{reel.post.content}</p> : null}
              </div>

              <div className="reel-actions">
                <button
                  className={
                    reel.post.viewer_reaction ? 'reel-action active' : 'reel-action'
                  }
                  disabled={reactionBusyIDs.has(reel.post.id)}
                  aria-label={reel.post.viewer_reaction ? 'Remove reaction' : 'Like reel'}
                  title={reel.post.viewer_reaction ? 'Remove reaction' : 'Like reel'}
                  onClick={() => toggleReaction(reel.post)}
                >
                  <Heart size={22} fill={reel.post.viewer_reaction ? 'currentColor' : 'none'} />
                  <span>{compactCount(reel.post.like_count)}</span>
                </button>
                <button className="reel-action" onClick={() => openComments(reel.post)}>
                  <MessageCircle size={22} />
                  <span>{compactCount(reel.post.comment_count)}</span>
                </button>
                <button className="reel-action" onClick={() => openShare(reel.post)}>
                  <Repeat2 size={22} />
                  <span>{compactCount(reel.post.share_count)}</span>
                </button>
                <button
                  className="reel-action reel-plan-action"
                  onClick={() => openShare(reel.post, 'Who wants to make this a plan?')}
                >
                  <CalendarCheck size={22} />
                  <span>Plan</span>
                </button>
              </div>
            </article>
          ))}
        </div>

        {reels.length > 0 && !isMobileReels ? (
          <div className="reel-step-controls">
            <button
              aria-label="Previous reel"
              disabled={activeReelIndex <= 0}
              type="button"
              onClick={() => scrollToReel(activeReelIndex - 1)}
            >
              <ChevronUp size={34} />
            </button>
            <button
              aria-label="Next reel"
              disabled={activeReelIndex >= reels.length - 1}
              type="button"
              onClick={() => scrollToReel(activeReelIndex + 1)}
            >
              <ChevronDown size={34} />
            </button>
          </div>
        ) : null}
      </div>

      {commentsPost ? (
        <aside className="reel-drawer">
          <header>
            <div>
              <strong>Comments</strong>
              <span>{commentsPost.comment_count} comments</span>
            </div>
            <button
              className="icon-button quiet"
              title="Close comments"
              onClick={() => setCommentsPost(null)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="reel-comments">
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
                </div>
              </div>
            ))}
          </div>
          <form className="comment-form" onSubmit={addComment}>
            <Avatar name={user?.display_name ?? 'U'} src={user?.avatar_url} />
            <input name="comment" placeholder="Write a comment" />
            <button className="icon-button" title="Send comment">
              <Send size={17} />
            </button>
          </form>
        </aside>
      ) : null}

      {sharePost ? (
        <aside className="reel-drawer share-drawer">
          <header>
            <div>
              <strong>Share reel</strong>
              <span>Share this video with friends</span>
            </div>
            <button
              className="icon-button quiet"
              title="Close share"
              onClick={() => {
                setSharePost(null)
                setShareDraft('')
              }}
            >
              <X size={18} />
            </button>
          </header>
          <form className="share-form" onSubmit={submitShare}>
            <textarea
              name="share_content"
              placeholder="Say something about this reel"
              value={shareDraft}
              onChange={(event) => setShareDraft(event.target.value)}
            />
            <button className="primary-button">
              <Repeat2 size={18} />
              <span>Share to feed</span>
            </button>
          </form>
        </aside>
      ) : null}
    </section>
  )
}

function compactCount(value: number) {
  if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(value)
}

function reelSourcePosts(post: Post) {
  const sources = [post]
  if (post.shared_post) {
    sources.push(post.shared_post)
  }
  return sources
}

function isPlanningReelPost(post: Post) {
  const text = [post.content, post.shared_post?.content].filter(Boolean).join(' ').toLowerCase()
  return [
    'plan',
    'join',
    'tonight',
    'today',
    'nearby',
    'food',
    'cafe',
    'momos',
    'event',
    'place',
    'weekend',
    'meet',
    'try',
  ].some((keyword) => text.includes(keyword))
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

function replacePost(post: Post, updated: Post): Post {
  if (post.id === updated.id) {
    return updated
  }
  if (post.shared_post?.id === updated.id) {
    return { ...post, shared_post: updated }
  }
  return post
}

function ReelsSkeleton() {
  return (
    <div className="reels-loading-card" aria-hidden="true">
      <span className="reels-loading-pill" />
      <div className="reels-loading-caption">
        <span className="reels-loading-avatar" />
        <div>
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
