import {
  CalendarCheck,
  Camera,
  ChevronDown,
  MapPin,
  MessageCircle,
  Pencil,
  Save,
  Shield,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/AppLayout'
import { ErrorBanner } from '../components/ErrorBanner'
import { PostCard } from '../components/PostCard'
import { api } from '../lib/api'
import { uploadToCloudinary } from '../lib/cloudinary'
import type { Post } from '../lib/types'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)

  useEffect(() => {
    if (!user) return
    api.userPosts(user.id).then((response) => setPosts(response.posts)).catch(() => undefined)
  }, [user])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const updated = await api.updateProfile({
        display_name: String(form.get('display_name')),
        username: String(form.get('username')),
        bio: String(form.get('bio')),
        location: String(form.get('location')),
        profile_visibility: String(form.get('profile_visibility')) as 'public' | 'friends' | 'private',
      })
      setUser(updated)
      setEditingProfile(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile')
    } finally {
      setBusy(false)
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      setUploadProgress(0)
      const media = await uploadToCloudinary(file, (progress) =>
        setUploadProgress(progress.percent),
      )
      const updated = await api.updateProfile({
        avatar_url: media.secure_url,
        avatar_public_id: media.cloudinary_public_id,
      })
      setUser(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed')
    } finally {
      setBusy(false)
      setUploadProgress(null)
      input.value = ''
    }
  }

  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      setUploadProgress(0)
      const media = await uploadToCloudinary(file, (progress) =>
        setUploadProgress(progress.percent),
      )
      const updated = await api.updateProfile({
        cover_url: media.secure_url,
        cover_public_id: media.cloudinary_public_id,
      })
      setUser(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover upload failed')
    } finally {
      setBusy(false)
      setUploadProgress(null)
      input.value = ''
    }
  }

  if (!user) return null

  function updatePost(post: Post) {
    setPosts((current) =>
      current.some((item) => item.id === post.id)
        ? current.map((item) => (item.id === post.id ? post : item))
        : [post, ...current],
    )
  }

  return (
    <section className="profile-hub">
      <header className="profile-cover-card">
        <div className="profile-cover">
          {user.cover_url ? (
            <img src={user.cover_url} alt="" />
          ) : (
            <div className="profile-cover-fallback" />
          )}
          <label className="profile-cover-action">
            <Camera size={18} />
            <span>Edit cover photo</span>
            <input accept="image/*" type="file" onChange={uploadCover} />
          </label>
        </div>

        <div className="profile-summary">
          <div className="profile-avatar-wrap">
            <Avatar name={user.display_name} src={user.avatar_url} />
            <label className="profile-avatar-action">
              <Camera size={18} />
              <input accept="image/*" type="file" onChange={uploadAvatar} />
            </label>
          </div>
          <div className="profile-title-block">
            <h1>{user.display_name}</h1>
            <strong>{posts.length} posts</strong>
            <span>@{user.username}</span>
          </div>
          <div className="profile-actions">
            <button className="primary-button" type="button" onClick={() => navigate('/')}>
              <CalendarCheck size={18} />
              <span>Plan your day</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => navigate('/feed')}
            >
              <MessageCircle size={18} />
              <span>Share update</span>
            </button>
            <button className="secondary-button icon-only" type="button" aria-label="More profile actions">
              <ChevronDown size={20} />
            </button>
          </div>
        </div>

        <nav className="profile-tabs" aria-label="Profile sections">
          {['All', 'About', 'Friends', 'Photos', 'Reels', 'More'].map((item) => (
            <button className={item === 'All' ? 'active' : ''} key={item} type="button">
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="content-grid profile-layout">
        <aside className="profile-left-column">
          <section className="panel profile-intro-card">
            <h2>Intro</h2>
            {user.bio ? <p>{user.bio}</p> : <p>Share a few details about yourself.</p>}
            <div className="profile-intro-list">
              <span>
                <Shield size={18} />
                {visibilityLabel(user.profile_visibility)} profile
              </span>
              <span>
                <MapPin size={18} />
                {user.location || 'Add location'}
              </span>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditingProfile(true)}
            >
              <Pencil size={17} />
              <span>Edit details</span>
            </button>
          </section>

          {editingProfile ? (
            <section className="panel profile-panel">
              <div>
                <h2>Edit profile</h2>
                <span>Update profile information and privacy.</span>
              </div>
              <ErrorBanner message={error} />
              <form className="form-stack" onSubmit={submit}>
                <label>
                  Display name
                  <input name="display_name" defaultValue={user.display_name} />
                </label>
                <label>
                  Username
                  <input name="username" defaultValue={user.username} />
                </label>
                <label>
                  Bio
                  <textarea name="bio" defaultValue={user.bio ?? ''} />
                </label>
                <label>
                  Location
                  <input name="location" defaultValue={user.location ?? ''} />
                </label>
                <label>
                  Visibility
                  <select name="profile_visibility" defaultValue={user.profile_visibility}>
                    <option value="friends">Friends</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
              {uploadProgress !== null ? (
                <div className="upload-progress" aria-label="Avatar upload progress">
                  <span style={{ width: `${uploadProgress}%` }} />
                  <strong>{uploadProgress}%</strong>
                </div>
              ) : null}
              <button className="primary-button" disabled={busy}>
                <Save size={18} />
                <span>{busy ? 'Saving' : 'Save profile'}</span>
              </button>
              </form>
            </section>
          ) : null}
        </aside>

        <div className="profile-feed-column">
          <div className="composer-card profile-composer">
            <Avatar name={user.display_name} src={user.avatar_url} />
            <div>What's on your mind?</div>
          </div>
          <div className="post-list">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onPostChange={updatePost} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function visibilityLabel(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}
