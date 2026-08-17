import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ImagePlus,
  Info,
  Plus,
  Search,
  Send,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/AppLayout'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { api } from '../lib/api'
import { cloudinaryDeliveryUrl, uploadToCloudinary } from '../lib/cloudinary'
import type { Conversation, Message, PostMediaInput, User } from '../lib/types'

const wsBaseUrl =
  import.meta.env.VITE_WS_BASE_URL ??
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    : 'ws://localhost:8080')

type MessageReceipt = {
  conversation_id: number
  message_ids: number[]
  messages?: MessageReceiptItem[]
  delivered_at?: string
  read_at?: string
  reader_id?: number
  recipient_id?: number
}

type MessageReceiptItem = {
  message_id: number
  user_id?: number
  delivered_at?: string
  read_at?: string
  recipient_count: number
  delivered_count: number
  read_count: number
}

export function ChatPage() {
  const { accessToken, user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [mediaDraft, setMediaDraft] = useState<PostMediaInput | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [conversationQuery, setConversationQuery] = useState('')
  const [friends, setFriends] = useState<User[]>([])
  const [groupComposerOpen, setGroupComposerOpen] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [selectedGroupMemberIDs, setSelectedGroupMemberIDs] = useState<number[]>([])
  const [groupBusy, setGroupBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScrollToLatest, setShowScrollToLatest] = useState(false)
  const [isMobileChat, setIsMobileChat] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 760px)').matches
      : false,
  )
  const [mobileChatView, setMobileChatView] = useState<'list' | 'thread'>('list')
  const [realtimeStatus, setRealtimeStatus] = useState<'Connecting' | 'Live' | 'Reconnecting'>(
    'Connecting',
  )
  const socketRef = useRef<WebSocket | null>(null)
  const activeRef = useRef<Conversation | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)

  async function loadConversations() {
    const response = await api.conversations()
    setConversations(response.conversations)
    setActive((current) =>
      current ?? (isMobileChat ? null : response.conversations[0] ?? null),
    )
  }

  async function loadFriends() {
    const response = await api.friends()
    setFriends(response.friends)
  }

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)')
    const update = () => setIsMobileChat(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    Promise.all([loadConversations(), loadFriends()]).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load chats'),
    )
  }, [])

  useEffect(() => {
    if (isMobileChat || active || conversations.length === 0) return
    setActive(conversations[0])
  }, [active, conversations, isMobileChat])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (!active) return
    api
      .messages(active.id)
      .then((response) => {
        setMessages(response.messages.reverse())
        return api.markConversationRead(active.id)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load messages'),
      )
  }, [active])

  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 120 || messages.length <= 1) {
      scrollToLatest()
    } else {
      setShowScrollToLatest(true)
    }
  }, [messages, active])

  function scrollToLatest() {
    window.requestAnimationFrame(() => {
      const container = messagesRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
      }
      setShowScrollToLatest(false)
    })
  }

  function handleMessagesScroll() {
    const container = messagesRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    setShowScrollToLatest(distanceFromBottom > 160)
  }

  useEffect(() => {
    if (!accessToken) return
    const token = accessToken
    const currentUserID = user?.id
    let stopped = false
    let retry: number | undefined

    function connect() {
      setRealtimeStatus('Connecting')
      const ws = new WebSocket(
        `${wsBaseUrl}/ws/chat?access_token=${encodeURIComponent(token)}`,
      )
      socketRef.current = ws

      ws.onopen = () => {
        setRealtimeStatus('Live')
      }
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data)
        if (payload.type === 'message.created') {
          const message = payload.data as Message
          if (activeRef.current?.id === message.conversation_id) {
            setMessages((current) =>
              current.some((item) => item.id === message.id)
                ? current
                : [...current, message],
            )
            if (message.sender_id !== currentUserID) {
              ws.send(
                JSON.stringify({
                  type: 'conversation.read',
                  conversation_id: message.conversation_id,
                }),
              )
            }
          }
          loadConversations().catch(() => undefined)
        }
        if (payload.type === 'message.delivered') {
          const receipt = payload.data as MessageReceipt
          applyReceipt(receipt, 'delivered')
        }
        if (payload.type === 'conversation.read') {
          const receipt = payload.data as MessageReceipt
          applyReceipt(receipt, 'read')
        }
      }
      ws.onclose = () => {
        if (stopped) return
        setRealtimeStatus('Reconnecting')
        retry = window.setTimeout(connect, 2000)
      }
      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      stopped = true
      if (retry) window.clearTimeout(retry)
      socketRef.current?.close()
    }
  }, [accessToken, user?.id])

  function applyReceipt(receipt: MessageReceipt, type: 'delivered' | 'read') {
    const messageIDs = receipt.message_ids ?? []
    const receiptByMessageID = new Map(
      (receipt.messages ?? []).map((item) => [item.message_id, item]),
    )
    setMessages((current) =>
      current.map((message) => {
        if (message.conversation_id !== receipt.conversation_id) return message
        if (
          messageIDs.length > 0 &&
          !messageIDs.includes(message.id)
        ) {
          return message
        }
        const item = receiptByMessageID.get(message.id)
        if (item) {
          return {
            ...message,
            delivered_at: item.delivered_at ?? message.delivered_at,
            read_at: item.read_at ?? message.read_at,
            recipient_count: item.recipient_count,
            delivered_count: item.delivered_count,
            read_count: item.read_count,
          }
        }
        if (type === 'read' && receipt.read_at) {
          return {
            ...message,
            delivered_at: message.delivered_at ?? receipt.read_at,
            read_at: receipt.read_at,
          }
        }
        if (type === 'delivered' && receipt.delivered_at) {
          return { ...message, delivered_at: receipt.delivered_at }
        }
        return message
      }),
    )
  }

  async function attachMedia(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setError(null)
    try {
      setUploadProgress(0)
      const uploaded = await uploadToCloudinary(file, (progress) =>
        setUploadProgress(progress.percent),
      )
      setMediaDraft(uploaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach media')
    } finally {
      setUploadProgress(null)
      input.value = ''
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!active) return
    const content = draft.trim()
    if (!content && !mediaDraft) return
    setDraft('')

    if (mediaDraft) {
      const message = await api.sendMessage(active.id, {
        message_type: mediaDraft.media_type,
        content: content || undefined,
        media_url: mediaDraft.secure_url,
        media_public_id: mediaDraft.cloudinary_public_id,
      })
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      )
      setMediaDraft(null)
      await loadConversations()
      return
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'message.send',
          conversation_id: active.id,
          message_type: 'text',
          content,
        }),
      )
      return
    }

    const message = await api.sendMessage(active.id, {
      message_type: 'text',
      content,
    })
    setMessages((current) => [...current, message])
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = groupTitle.trim()
    if (!title || selectedGroupMemberIDs.length < 2) return

    setGroupBusy(true)
    setError(null)
    try {
      const conversation = await api.createGroupConversation({
        title,
        member_ids: selectedGroupMemberIDs,
      })
      await loadConversations()
      setActive(conversation)
      setMobileChatView('thread')
      setGroupComposerOpen(false)
      setGroupTitle('')
      setSelectedGroupMemberIDs([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
    } finally {
      setGroupBusy(false)
    }
  }

  function toggleGroupMember(friendID: number) {
    setSelectedGroupMemberIDs((current) =>
      current.includes(friendID)
        ? current.filter((id) => id !== friendID)
        : [...current, friendID],
    )
  }

  const filteredConversations = useMemo(() => {
    const term = conversationQuery.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((conversation) => {
      const haystack = [
        conversationDisplayName(conversation),
        conversationSubtitle(conversation),
        ...(conversation.members ?? []).map((member) => `${member.display_name} ${member.username}`),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [conversationQuery, conversations])

  return (
    <section
      className={
        mobileChatView === 'thread'
          ? 'messenger-shell mobile-thread-open'
          : 'messenger-shell mobile-list-open'
      }
    >
      <aside className="conversation-list">
        <div className="chat-list-header">
          <div>
            <span>Messaging</span>
            <h2>Chats</h2>
          </div>
          <div className="chat-list-actions">
            <button
              aria-label="Create group"
              className="icon-button quiet"
              type="button"
              onClick={() => setGroupComposerOpen((open) => !open)}
            >
              <Plus size={19} />
            </button>
            <RealtimeBadge status={realtimeStatus} />
          </div>
        </div>
        <ErrorBanner message={error} />
        {groupComposerOpen ? (
          <form className="group-composer" onSubmit={createGroup}>
            <div className="group-composer-heading">
              <Users size={18} />
              <strong>New group</strong>
              <button
                aria-label="Close group composer"
                className="icon-button quiet"
                type="button"
                onClick={() => setGroupComposerOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <input
              maxLength={120}
              placeholder="Group name"
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
            />
            <div className="group-member-picker">
              {friends.map((friend) => (
                <label key={friend.id} className="group-member-option">
                  <input
                    checked={selectedGroupMemberIDs.includes(friend.id)}
                    type="checkbox"
                    onChange={() => toggleGroupMember(friend.id)}
                  />
                  <Avatar name={friend.display_name} src={friend.avatar_url} />
                  <span>
                    <strong>{friend.display_name}</strong>
                    <small>@{friend.username}</small>
                  </span>
                </label>
              ))}
            </div>
            <button
              className="primary-button"
              disabled={!groupTitle.trim() || selectedGroupMemberIDs.length < 2 || groupBusy}
              type="submit"
            >
              <Users size={17} />
              <span>{groupBusy ? 'Creating' : 'Create group'}</span>
            </button>
          </form>
        ) : null}
        <label className="conversation-search">
          <Search size={17} />
          <input
            placeholder="Search chats"
            value={conversationQuery}
            onChange={(event) => setConversationQuery(event.target.value)}
          />
        </label>
        {filteredConversations.length === 0 ? (
          <EmptyState title="Start chat from Friends" />
        ) : null}
        <div className="conversation-stack">
          {filteredConversations.map((conversation) => (
            <button
              className={
                active?.id === conversation.id ? 'conversation active' : 'conversation'
              }
              key={conversation.id}
              onClick={() => {
                setActive(conversation)
                setMobileChatView('thread')
              }}
            >
              <ConversationAvatar conversation={conversation} />
              <div>
                <strong>{conversationDisplayName(conversation)}</strong>
                <span>{conversation.latest_message?.content ?? 'No messages yet'}</span>
              </div>
              <small>{formatShortTime(conversation.updated_at)}</small>
            </button>
          ))}
        </div>
      </aside>

      <div className="message-panel">
        {active ? (
          <>
            <header className="message-header">
              <button
                aria-label="Back to chats"
                className="mobile-chat-back icon-button quiet"
                type="button"
                onClick={() => setMobileChatView('list')}
              >
                <ArrowLeft size={21} />
              </button>
              <Avatar
                name={conversationDisplayName(active)}
                src={conversationAvatarUrl(active)}
              />
              <div>
                <h2>{conversationDisplayName(active)}</h2>
                <span>{conversationSubtitle(active)}</span>
              </div>
              <button className="icon-button quiet" title="Conversation details">
                <Info size={19} />
              </button>
            </header>

            <div className="messages-wrap">
              <div
                className="messages"
                ref={messagesRef}
                onScroll={handleMessagesScroll}
              >
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    mine={message.sender_id === user?.id}
                    receipt={message.sender_id === user?.id ? messageReceipt(message) : undefined}
                  />
                ))}
              </div>
              {showScrollToLatest ? (
                <button
                  className="scroll-latest-button"
                  title="Jump to latest message"
                  onClick={scrollToLatest}
                >
                  <ChevronDown size={19} />
                </button>
              ) : null}
            </div>

            <form className="message-form" onSubmit={send}>
              {mediaDraft ? (
                <div className="message-attachment-preview">
                  {mediaDraft.media_type === 'video' ? (
                    <video
                      muted
                      playsInline
                      preload="metadata"
                      src={cloudinaryDeliveryUrl(mediaDraft.media_type, mediaDraft.secure_url)}
                    />
                  ) : (
                    <img
                      src={cloudinaryDeliveryUrl(mediaDraft.media_type, mediaDraft.secure_url)}
                      alt=""
                    />
                  )}
                  <button
                    className="media-remove"
                    title="Remove attachment"
                    type="button"
                    onClick={() => setMediaDraft(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : null}
              {uploadProgress !== null ? (
                <div className="upload-progress" aria-label="Chat upload progress">
                  <span style={{ width: `${uploadProgress}%` }} />
                  <strong>{uploadProgress}%</strong>
                </div>
              ) : null}
              <div className="message-compose-row">
                <label className="icon-button message-tool" title="Attach media">
                  <ImagePlus size={18} />
                  <input accept="image/*,video/*" type="file" onChange={attachMedia} />
                </label>
                <input
                  name="content"
                  placeholder="Message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button
                  className="primary-button send-circle"
                  disabled={!draft.trim() && !mediaDraft}
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <EmptyState title="Select a conversation" />
        )}
      </div>
    </section>
  )
}

function ConversationAvatar({ conversation }: { conversation: Conversation }) {
  if (conversation.conversation_type === 'group') {
    return (
      <span className="group-avatar" aria-hidden="true">
        <Users size={21} />
      </span>
    )
  }

  return (
    <Avatar
      name={conversationDisplayName(conversation)}
      src={conversationAvatarUrl(conversation)}
    />
  )
}

function conversationDisplayName(conversation: Conversation) {
  if (conversation.conversation_type === 'group') {
    return conversation.title ?? 'Group chat'
  }

  return conversation.other_user?.display_name ?? 'Chat'
}

function conversationAvatarUrl(conversation: Conversation) {
  return conversation.conversation_type === 'direct'
    ? conversation.other_user?.avatar_url
    : undefined
}

function conversationSubtitle(conversation: Conversation) {
  if (conversation.conversation_type === 'group') {
    return `${conversation.member_count} members`
  }

  return conversation.other_user
    ? `@${conversation.other_user.username} - friend conversation`
    : 'Friend conversation'
}

function RealtimeBadge({ status }: { status: 'Connecting' | 'Live' | 'Reconnecting' }) {
  const online = status === 'Live'
  return (
    <span className={online ? 'realtime-badge live' : 'realtime-badge'}>
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}
      {status}
    </span>
  )
}

function MessageBubble({
  message,
  mine,
  receipt,
}: {
  message: Message
  mine: boolean
  receipt?: 'sent' | 'delivered' | 'read'
}) {
  return (
    <div className={mine ? 'message mine' : 'message'}>
      <div className={message.media_url ? 'message-bubble media' : 'message-bubble'}>
        {message.media_url ? (
          <div className="message-media">
            {message.message_type === 'video' ? (
              <video controls playsInline src={message.media_url} />
            ) : (
              <img src={message.media_url} alt="" />
            )}
          </div>
        ) : null}
        {message.content ? <span className="message-text">{message.content}</span> : null}
        <small className="message-meta">
          <span>{formatShortTime(message.created_at)}</span>
          {receipt ? (
            <MessageReceiptIndicator message={message} status={receipt} />
          ) : null}
        </small>
      </div>
    </div>
  )
}

function MessageReceiptIndicator({
  message,
  status,
}: {
  message: Message
  status: 'sent' | 'delivered' | 'read'
}) {
  const title = receiptTitle(message, status)
  if (status === 'sent') {
    return (
      <span className="message-receipt" title={title}>
        <Check size={14} strokeWidth={2.5} />
      </span>
    )
  }

  return (
    <span
      className={
        status === 'read' ? 'message-receipt read' : 'message-receipt delivered'
      }
      title={title}
    >
      <CheckCheck size={15} strokeWidth={2.5} />
    </span>
  )
}

function messageReceipt(message: Message): 'sent' | 'delivered' | 'read' {
  if (message.recipient_count > 0) {
    if (message.read_count >= message.recipient_count) return 'read'
    if (message.delivered_count >= message.recipient_count) return 'delivered'
    return 'sent'
  }
  if (message.read_at) return 'read'
  if (message.delivered_at) return 'delivered'
  return 'sent'
}

function receiptTitle(message: Message, status: 'sent' | 'delivered' | 'read') {
  if (message.recipient_count > 0) {
    if (status === 'read') {
      return `Seen by ${message.read_count}/${message.recipient_count}`
    }
    if (status === 'delivered') {
      return `Delivered to ${message.delivered_count}/${message.recipient_count}`
    }
    return `Sent - delivered to ${message.delivered_count}/${message.recipient_count}`
  }

  if (status === 'read') return 'Read'
  if (status === 'delivered') return 'Delivered'
  return 'Sent'
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
