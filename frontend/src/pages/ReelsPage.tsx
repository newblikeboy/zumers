import {
  BadgePlus,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Pause,
  Play,
  Repeat2,
  Send,
  Star,
  ThumbsUp,
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

  const reels = useMemo(
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

  useEffect(() => {
    if (reels.length > 0 && !activeReelID) {
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
    setError(null)
    try {
      const updated = post.viewer_reaction
        ? await api.removePostReaction(post.id)
        : await api.reactToPost(post.id)
      updatePost(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update reaction')
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

  function scrollToReel(index: number) {
    const reel = reels[index]
    if (!reel) return
    setActiveReelID(reel.id)
    setPaused(false)
  }

  return (
    <section className={drawerOpen ? 'reels-page has-drawer' : 'reels-page'}>
      <aside className="reels-nav">
        <h1>Reels</h1>
        <nav aria-label="Reels navigation">
          <button className="reels-nav-item active" type="button">
            <Star size={23} />
            <span>For you</span>
          </button>
          <button className="reels-nav-item" type="button">
            <BadgePlus size={23} />
            <span>Following</span>
          </button>
          <button className="reels-nav-item" type="button">
            <UserCircle size={23} />
            <span>Profile</span>
          </button>
        </nav>
      </aside>

        <div className="reels-stage">
        <ErrorBanner message={error} />
        {loading && reels.length === 0 ? <ReelsSkeleton /> : null}
        {!loading && reels.length === 0 ? (
          <EmptyState title="No reels yet. Upload a video post to create one." />
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
                  onClick={() => toggleReaction(reel.post)}
                >
                  <ThumbsUp size={22} />
                  <span>{compactCount(reel.post.like_count)}</span>
                </button>
                <button className="reel-action" onClick={() => openComments(reel.post)}>
                  <MessageCircle size={22} />
                  <span>{compactCount(reel.post.comment_count)}</span>
                </button>
                <button className="reel-action" onClick={() => setSharePost(reel.post)}>
                  <Repeat2 size={22} />
                  <span>{compactCount(reel.post.share_count)}</span>
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
              onClick={() => setSharePost(null)}
            >
              <X size={18} />
            </button>
          </header>
          <form className="share-form" onSubmit={submitShare}>
            <textarea
              name="share_content"
              placeholder="Say something about this reel"
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
