import {
  Globe2,
  Image,
  ImagePlus,
  LockKeyhole,
  Send,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/AppLayout'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { PostCard } from '../components/PostCard'
import { api } from '../lib/api'
import { cloudinaryDeliveryUrl, uploadToCloudinary } from '../lib/cloudinary'
import type { Post, PostMediaInput } from '../lib/types'

const visibilityOptions = [
  { value: 'public', label: 'Public', icon: Globe2 },
  { value: 'friends', label: 'Friends', icon: Users },
  { value: 'private', label: 'Only me', icon: LockKeyhole },
] as const

const pulseFilters = ['For You', 'Friends', 'Nearby', 'Following']
const feedCachePrefix = 'zumers.feed.'
const reelsCachePrefix = 'zumers.reels.'

function readCachedFeed(userID?: number) {
  if (!userID) return null

  try {
    const cached = sessionStorage.getItem(`${feedCachePrefix}${userID}`)
    if (!cached) return null
    const parsed = JSON.parse(cached) as { posts?: Post[] }
    return Array.isArray(parsed.posts) ? parsed.posts : null
  } catch {
    return null
  }
}

function writeCachedFeed(userID: number | undefined, posts: Post[]) {
  if (!userID) return

  try {
    sessionStorage.setItem(
      `${feedCachePrefix}${userID}`,
      JSON.stringify({ posts }),
    )
  } catch {
    // Cache failure should never block the feed.
  }
}

export function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>(
    'friends',
  )
  const [media, setMedia] = useState<PostMediaInput[]>([])
  const [activeFilter, setActiveFilter] = useState(pulseFilters[0])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const cachedPosts = readCachedFeed(user.id)
    if (cachedPosts) {
      setPosts(cachedPosts)
    }
    setLoading(!cachedPosts)
    setError(null)

    api
      .feed()
      .then((response) => {
        if (cancelled) return
        setPosts(response.posts)
        writeCachedFeed(user.id, response.posts)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load feed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  function updatePosts(updater: (current: Post[]) => Post[]) {
    setPosts((current) => {
      const next = updater(current)
      writeCachedFeed(user?.id, next)
      return next
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim() && media.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const created = await api.createPost({
        content: content.trim() || undefined,
        visibility,
        media,
      })
      updatePosts((current) => [created, ...current])
      if (created.media?.some((item) => item.media_type === 'video')) {
        sessionStorage.removeItem(`${reelsCachePrefix}${user?.id}`)
      }
      setContent('')
      setMedia([])
      setVisibility('friends')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish post')
    } finally {
      setBusy(false)
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      setUploadProgress(0)
      const uploaded = await uploadToCloudinary(file, (progress) =>
        setUploadProgress(progress.percent),
      )
      setMedia((current) => [
        ...current,
        { ...uploaded, display_order: current.length },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      setUploadProgress(null)
      input.value = ''
    }
  }

  async function deletePost(id: number) {
    await api.deletePost(id)
    updatePosts((current) => current.filter((post) => post.id !== id))
  }

  function upsertPost(post: Post) {
    updatePosts((current) => {
      const exists = current.some((item) => item.id === post.id)
      if (exists) {
        return current.map((item) => (item.id === post.id ? post : item))
      }
      return [post, ...current]
    })
  }

  function removeMedia(publicID: string) {
    setMedia((current) =>
      current
        .filter((item) => item.cloudinary_public_id !== publicID)
        .map((item, index) => ({ ...item, display_order: index })),
    )
  }

  const canPost = content.trim().length > 0 || media.length > 0
  const showInitialSkeleton = loading && posts.length === 0
  const planReadyPosts = posts.filter((post) => isPlanReadyPost(post)).slice(0, 3)
  const mediaPostCount = posts.filter((post) => (post.media ?? []).length > 0).length

  return (
    <section className="social-home pulse-page">
      <main className="feed-stream">
        <div className="pulse-filter-tabs" role="tablist" aria-label="Feed filters">
          {pulseFilters.map((filter) => (
            <button
              className={activeFilter === filter ? 'active' : ''}
              key={filter}
              role="tab"
              type="button"
              aria-selected={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="composer-card">
          <div className="composer-heading">
            <strong>Share</strong>
            <span>{visibilityOptions.find((option) => option.value === visibility)?.label}</span>
          </div>
          <div className="composer-entry">
            <Avatar name={user?.display_name ?? 'U'} src={user?.avatar_url} />
            <textarea
              aria-label="Share to Feed"
              placeholder="What's on your mind?"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <ErrorBanner message={error} />
          <form onSubmit={submit}>
            <div className="privacy-segment" aria-label="Post visibility">
              {visibilityOptions.map((option) => (
                <button
                  className={visibility === option.value ? 'segment active' : 'segment'}
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value)}
                >
                  <option.icon size={16} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            {media.length > 0 ? (
              <div className="composer-media-preview">
                {media.map((item) => (
                  <div className="media-preview-tile" key={item.cloudinary_public_id}>
                    {item.media_type === 'video' ? (
                      <video
                        muted
                        playsInline
                        preload="metadata"
                        src={cloudinaryDeliveryUrl(item.media_type, item.secure_url)}
                      />
                    ) : (
                      <img
                        src={cloudinaryDeliveryUrl(item.media_type, item.secure_url)}
                        alt=""
                      />
                    )}
                    <span>
                      {item.media_type === 'video' ? (
                        <Video size={14} />
                      ) : (
                        <Image size={14} />
                      )}
                      {item.media_type}
                    </span>
                    <button
                      className="media-remove"
                      title="Remove media"
                      type="button"
                      onClick={() => removeMedia(item.cloudinary_public_id)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {uploadProgress !== null ? (
              <div className="upload-progress" aria-label="Upload progress">
                <span style={{ width: `${uploadProgress}%` }} />
                <strong>{uploadProgress}%</strong>
              </div>
            ) : null}

            <div className="composer-action-bar">
              <label className="composer-tool">
                <ImagePlus size={19} />
                <span>Photo/video</span>
                <input accept="image/*,video/*" type="file" onChange={upload} />
              </label>
              <button className="primary-button post-submit" disabled={busy || !canPost}>
                <Send size={18} />
                <span>{busy ? 'Publishing' : 'Share to Feed'}</span>
              </button>
            </div>
          </form>
        </div>

        <div className="post-list">
          {showInitialSkeleton ? <FeedSkeleton /> : null}
          {!loading && posts.length === 0 ? (
            <EmptyState
              actionLabel="Discover"
              actionTo="/"
              title="No Feed yet"
            />
          ) : null}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={deletePost}
              onPostChange={upsertPost}
            />
          ))}
        </div>
      </main>

      <aside className="pulse-context-rail" aria-label="Feed context">
        <section>
          <span>Pending</span>
          <h2>{planReadyPosts.length || 0}</h2>
        </section>
        <section>
          <span>City</span>
          <div className="pulse-mini-metrics">
            <strong>{posts.length}</strong>
            <small>Feed items</small>
            <strong>{mediaPostCount}</strong>
            <small>visual drops</small>
          </div>
        </section>
        <section>
          <span>Quick</span>
          <a href="/friends">Invite</a>
          <a href="/chat">Messages</a>
        </section>
      </aside>
    </section>
  )
}

function isPlanReadyPost(post: Post) {
  const text = [post.content, post.shared_post?.content].filter(Boolean).join(' ').toLowerCase()
  return ['plan', 'tonight', 'weekend', 'join', 'vote', 'place', 'food', 'cafe', 'event'].some((keyword) =>
    text.includes(keyword),
  )
}

function FeedSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <article
          aria-hidden="true"
          className="post-card feed-skeleton-card"
          key={index}
        >
          <div className="skeleton-header">
            <span className="skeleton-avatar" />
            <div>
              <span className="skeleton-line title" />
              <span className="skeleton-line meta" />
            </div>
          </div>
          <span className="skeleton-line copy" />
          <span className="skeleton-line copy short" />
          <div className="skeleton-media" />
          <div className="skeleton-actions">
            <span />
            <span />
            <span />
          </div>
        </article>
      ))}
    </>
  )
}
