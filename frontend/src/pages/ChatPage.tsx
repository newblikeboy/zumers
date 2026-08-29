import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Crown,
  Heart,
  ImagePlus,
  Info,
  MapPin,
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
import type { MessageHistoryResponse } from '../lib/api'
import {
  preloadChatData,
  readCachedChatConversations,
  readCachedChatFriends,
  writeCachedChatConversations,
} from '../lib/chatDataCache'
import { cloudinaryDeliveryUrl, uploadToCloudinary } from '../lib/cloudinary'
import type {
  BusinessShareVoteSummary,
  Conversation,
  Message,
  PostMediaInput,
  SharedBusinessMessage,
  User,
} from '../lib/types'

const wsBaseUrl =
  import.meta.env.VITE_WS_BASE_URL ??
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    : 'ws://localhost:8080')

const pendingBusinessShareKey = 'zumers.pendingBusinessShare'
const messagePageSize = 30

type MessagePageInfo = {
  hasMore: boolean
  nextBeforeID?: number
}

type MessageReceipt = {
  conversation_id: number
  message_ids: number[]
  messages?: MessageReceiptItem[]
  delivered_at?: string
  read_at?: string
  reader_id?: number
  recipient_id?: number
  recipient_ids?: number[]
}

type MessageReceiptItem = {
  message_id: number
  user_id?: number
  user?: User
  delivered_at?: string
  read_at?: string
  recipient_count: number
  delivered_count: number
  read_count: number
}

export function ChatPage() {
  const { accessToken, user } = useAuth()
  const cachedConversations = readCachedChatConversations(user?.id)
  const cachedFriends = readCachedChatFriends(user?.id)
  const [conversations, setConversations] = useState<Conversation[]>(() => cachedConversations ?? [])
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [mediaDraft, setMediaDraft] = useState<PostMediaInput | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [conversationQuery, setConversationQuery] = useState('')
  const [friends, setFriends] = useState<User[]>(() => cachedFriends ?? [])
  const [chatLoading, setChatLoading] = useState(() => !cachedConversations || !cachedFriends)
  const [groupComposerOpen, setGroupComposerOpen] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [selectedGroupMemberIDs, setSelectedGroupMemberIDs] = useState<number[]>([])
  const [groupBusy, setGroupBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScrollToLatest, setShowScrollToLatest] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedMessageID, setSelectedMessageID] = useState<number | null>(null)
  const [olderLoadingConversationID, setOlderLoadingConversationID] = useState<number | null>(null)
  const [pendingBusinessShare, setPendingBusinessShare] = useState<SharedBusinessMessage | null>(null)
  const [shareBusyConversationID, setShareBusyConversationID] = useState<number | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
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
  const messageCacheRef = useRef(new Map<number, Message[]>())
  const messagePageInfoRef = useRef<Record<number, MessagePageInfo>>({})
  const messageLoadRef = useRef(0)
  const olderLoadRef = useRef(new Set<number>())
  const shouldScrollLatestRef = useRef(false)
  const messagesRef = useRef<HTMLDivElement | null>(null)

  async function loadConversations() {
    const response = await api.conversations()
    setConversations(response.conversations)
    writeCachedChatConversations(user?.id, response.conversations)
    setActive((current) => {
      if (current) {
        return response.conversations.find((conversation) => conversation.id === current.id) ?? current
      }
      return isMobileChat ? null : response.conversations[0] ?? null
    })
  }

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)')
    const update = () => setIsMobileChat(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!user?.id) return

    const cachedChatConversations = readCachedChatConversations(user.id)
    const cachedChatFriends = readCachedChatFriends(user.id)
    if (cachedChatConversations) setConversations(cachedChatConversations)
    if (cachedChatFriends) setFriends(cachedChatFriends)
    setChatLoading(!cachedChatConversations || !cachedChatFriends)

    let cancelled = false
    preloadChatData(user.id)
      .then((data) => {
        if (cancelled) return
        setConversations(data.conversations)
        setFriends(data.friends)
        setActive((current) => {
          if (current) {
            return data.conversations.find((conversation) => conversation.id === current.id) ?? current
          }
          return isMobileChat ? null : data.conversations[0] ?? null
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load chats')
        }
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isMobileChat, user?.id])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(pendingBusinessShareKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as SharedBusinessMessage
      if (parsed?.business_id && parsed.title && parsed.business_name) {
        setPendingBusinessShare(parsed)
        setMobileChatView('list')
      }
    } catch {
      sessionStorage.removeItem(pendingBusinessShareKey)
    }
  }, [])

  useEffect(() => {
    if (isMobileChat || active || conversations.length === 0) return
    setActive(conversations[0])
  }, [active, conversations, isMobileChat])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    setDetailsOpen(false)
    setSelectedMessageID(null)
  }, [active?.id])

  useEffect(() => {
    if (!active) {
      setMessages([])
      return
    }

    const conversationID = active.id
    const loadID = messageLoadRef.current + 1
    messageLoadRef.current = loadID
    shouldScrollLatestRef.current = true
    const cachedMessages = messageCacheRef.current.get(conversationID)
    setMessages(cachedMessages ?? [])
    setShowScrollToLatest(false)

    let cancelled = false
    const controller = new AbortController()
    api
      .messages(conversationID, {
        fast: true,
        limit: messagePageSize,
        signal: controller.signal,
      })
      .then((response) => {
        if (cancelled || messageLoadRef.current !== loadID) return
        const fastMessages = [...response.messages].reverse()
        updateMessagePageInfo(conversationID, response)
        setConversationMessages(conversationID, (current) =>
          mergeMessages(current, fastMessages),
        )
        if (activeRef.current?.id === conversationID) {
          scrollToLatest('auto')
        }
        void api.markConversationRead(conversationID).catch(() => undefined)

        void api
          .messages(conversationID, {
            limit: messagePageSize,
            signal: controller.signal,
          })
          .then((fullResponse) => {
            if (cancelled || messageLoadRef.current !== loadID) return
            const fullMessages = [...fullResponse.messages].reverse()
            updateMessagePageInfo(conversationID, fullResponse)
            setConversationMessages(conversationID, (current) =>
              mergeMessages(current, fullMessages),
            )
            const container = messagesRef.current
            if (activeRef.current?.id === conversationID && container) {
              const distanceFromBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight
              if (distanceFromBottom < 240) {
                scrollToLatest('auto')
              }
            }
          })
          .catch(() => undefined)
      })
      .catch((err) => {
        if (cancelled || cachedMessages || isAbortError(err)) return
        setError(err instanceof Error ? err.message : 'Could not load messages')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [active?.id])

  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    if (shouldScrollLatestRef.current && messages.length > 0) {
      shouldScrollLatestRef.current = false
      scrollToLatest('auto')
      return
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 120 || messages.length <= 1) {
      scrollToLatest()
    } else {
      setShowScrollToLatest(true)
    }
  }, [messages, active])

  function scrollToLatest(behavior?: ScrollBehavior) {
    window.requestAnimationFrame(() => {
      const container = messagesRef.current
      if (container) {
        const previousScrollBehavior = container.style.scrollBehavior
        if (behavior) {
          container.style.scrollBehavior = behavior
        }
        container.scrollTop = container.scrollHeight
        if (behavior) {
          window.requestAnimationFrame(() => {
            container.style.scrollBehavior = previousScrollBehavior
          })
        }
      }
      setShowScrollToLatest(false)
    })
  }

  function handleMessagesScroll() {
    const container = messagesRef.current
    if (!container) return
    if (container.scrollTop < 96) {
      void loadOlderMessages()
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    setShowScrollToLatest(distanceFromBottom > 160)
  }

  function updateMessagePageInfo(conversationID: number, response: MessageHistoryResponse) {
    messagePageInfoRef.current = {
      ...messagePageInfoRef.current,
      [conversationID]: {
        hasMore: response.has_more,
        nextBeforeID: response.next_before_id ?? undefined,
      },
    }
  }

  function setConversationMessages(
    conversationID: number,
    updater: (current: Message[]) => Message[],
  ) {
    if (activeRef.current?.id === conversationID) {
      setMessages((current) => {
        const next = updater(messageCacheRef.current.get(conversationID) ?? current)
        messageCacheRef.current.set(conversationID, next)
        return next
      })
      return
    }

    const next = updater(messageCacheRef.current.get(conversationID) ?? [])
    messageCacheRef.current.set(conversationID, next)
  }

  function restoreConversationMessages(conversationID: number, messagesToRestore: Message[]) {
    messageCacheRef.current.set(conversationID, messagesToRestore)
    if (activeRef.current?.id === conversationID) {
      setMessages(messagesToRestore)
    }
  }

  async function loadOlderMessages() {
    const conversation = activeRef.current
    if (!conversation) return

    const conversationID = conversation.id
    const pageInfo = messagePageInfoRef.current[conversationID]
    if (pageInfo?.hasMore === false || olderLoadRef.current.has(conversationID)) return

    const cachedMessages = messageCacheRef.current.get(conversationID) ?? messages
    const beforeID = pageInfo?.nextBeforeID ?? cachedMessages[0]?.id
    if (!beforeID) return

    const container = messagesRef.current
    const previousScrollHeight = container?.scrollHeight ?? 0
    const previousScrollTop = container?.scrollTop ?? 0

    olderLoadRef.current.add(conversationID)
    setOlderLoadingConversationID(conversationID)
    try {
      const response = await api.messages(conversationID, {
        beforeId: beforeID,
        limit: messagePageSize,
      })
      const olderMessages = [...response.messages].reverse()
      updateMessagePageInfo(conversationID, response)
      setConversationMessages(conversationID, (current) =>
        mergeMessages(current, olderMessages),
      )
      window.requestAnimationFrame(() => {
        if (activeRef.current?.id !== conversationID) return
        const latestContainer = messagesRef.current
        if (!latestContainer) return
        const previousScrollBehavior = latestContainer.style.scrollBehavior
        latestContainer.style.scrollBehavior = 'auto'
        latestContainer.scrollTop =
          latestContainer.scrollHeight - previousScrollHeight + previousScrollTop
        window.requestAnimationFrame(() => {
          latestContainer.style.scrollBehavior = previousScrollBehavior
        })
      })
    } catch (err) {
      if (activeRef.current?.id === conversationID) {
        setError(err instanceof Error ? err.message : 'Could not load older messages')
      }
    } finally {
      olderLoadRef.current.delete(conversationID)
      setOlderLoadingConversationID((current) =>
        current === conversationID ? null : current,
      )
    }
  }

  useEffect(() => {
    if (!accessToken) return
    const currentUserID = user?.id
    let stopped = false
    let retry: number | undefined

    async function connect() {
      setRealtimeStatus('Connecting')
      let ticket: string
      try {
        const response = await api.chatTicket()
        ticket = response.ticket
      } catch {
        if (!stopped) {
          setRealtimeStatus('Reconnecting')
          retry = window.setTimeout(connect, 2000)
        }
        return
      }
      if (stopped) return

      const ws = new WebSocket(`${wsBaseUrl}/ws/chat?ticket=${encodeURIComponent(ticket)}`)
      socketRef.current = ws

      ws.onopen = () => {
        setRealtimeStatus('Live')
      }
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data)
        if (payload.type === 'message.created') {
          const message = payload.data as Message
          setConversationMessages(message.conversation_id, (current) =>
            current.some((item) => item.id === message.id)
              ? current
              : [...current, message],
          )
          if (activeRef.current?.id === message.conversation_id) {
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
        if (payload.type === 'business_share.vote') {
          applyBusinessVoteSummary(payload.data as BusinessShareVoteSummary)
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
    setConversationMessages(receipt.conversation_id, (current) =>
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
          return updateReceiptParticipants({
            ...message,
            delivered_at: item.delivered_at ?? message.delivered_at,
            read_at: item.read_at ?? message.read_at,
            recipient_count: item.recipient_count,
            delivered_count: item.delivered_count,
            read_count: item.read_count,
          }, receipt, type)
        }
        if (type === 'read' && receipt.read_at) {
          return updateReceiptParticipants({
            ...message,
            delivered_at: message.delivered_at ?? receipt.read_at,
            read_at: receipt.read_at,
          }, receipt, type)
        }
        if (type === 'delivered' && receipt.delivered_at) {
          return updateReceiptParticipants(
            { ...message, delivered_at: receipt.delivered_at },
            receipt,
            type,
          )
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
      setConversationMessages(active.id, (current) =>
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
    setConversationMessages(active.id, (current) => [...current, message])
  }

  async function shareBusinessToConversation(conversation: Conversation) {
    if (!pendingBusinessShare) return
    setShareBusyConversationID(conversation.id)
    setShareError(null)
    try {
      const message = await api.sendBusinessShare(
        conversation.id,
        JSON.stringify(pendingBusinessShare),
      )
      sessionStorage.removeItem(pendingBusinessShareKey)
      setPendingBusinessShare(null)
      setActive(conversation)
      setMobileChatView('thread')
      setConversationMessages(conversation.id, (current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      )
      await loadConversations()
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share business')
    } finally {
      setShareBusyConversationID(null)
    }
  }

  async function voteBusinessShare(messageID: number) {
    if (!active) return
    const conversationID = active.id
    const previousMessages = messageCacheRef.current.get(conversationID) ?? messages
    setConversationMessages(conversationID, (current) =>
      current.map((message) => {
        if (message.id !== messageID) return message
        return {
          ...message,
          business_vote: optimisticBusinessVoteSummary(message, active),
        }
      })
    )
    try {
      const summary = await api.voteBusinessShare(messageID, 'like')
      applyBusinessVoteSummary(summary)
    } catch (err) {
      restoreConversationMessages(conversationID, previousMessages)
      setError(err instanceof Error ? err.message : 'Could not save vote')
    }
  }

  function applyBusinessVoteSummary(summary: BusinessShareVoteSummary) {
    let conversationID = activeRef.current?.id
    for (const [cachedConversationID, cachedMessages] of messageCacheRef.current) {
      if (cachedMessages.some((message) => message.id === summary.message_id)) {
        conversationID = cachedConversationID
        break
      }
    }
    if (!conversationID) return
    setConversationMessages(conversationID, (current) =>
      current.map((message) => {
        if (message.id !== summary.message_id) return message
        return {
          ...message,
          business_vote: {
            ...summary,
            my_vote: summary.my_vote ?? message.business_vote?.my_vote,
          },
        }
      }),
    )
  }

  function optimisticBusinessVoteSummary(
    message: Message,
    conversation: Conversation,
  ): BusinessShareVoteSummary {
    const current = message.business_vote
    const previousVote = current?.my_vote
    const participantCount = current?.participant_count ?? conversation.member_count
    let likeCount = current?.like_count ?? 0

    if (previousVote === 'like') {
      return {
        message_id: message.id,
        like_count: likeCount,
        dislike_count: current?.dislike_count ?? 0,
        participant_count: participantCount,
        my_vote: 'like',
        all_liked: participantCount > 0 && likeCount === participantCount,
        recommendation_text: current?.recommendation_text,
      }
    }

    likeCount += 1

    const allLiked = participantCount > 0 && likeCount === participantCount
    return {
      message_id: message.id,
      like_count: likeCount,
      dislike_count: current?.dislike_count ?? 0,
      participant_count: participantCount,
      my_vote: 'like',
      all_liked: allLiked,
      recommendation_text: allLiked
        ? conversation.conversation_type === 'group'
          ? 'This is the perfect choice for your group.'
          : 'This is best for both of you.'
        : undefined,
    }
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

  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageID) ?? null,
    [messages, selectedMessageID],
  )

  useEffect(() => {
    if (!detailsOpen || !selectedMessage || selectedMessage.receipts?.length) {
      return
    }

    const messageID = selectedMessage.id
    const conversationID = selectedMessage.conversation_id
    let cancelled = false
    api
      .messageReceipts(messageID)
      .then((response) => {
        if (cancelled) return
        setConversationMessages(conversationID, (current) =>
          current.map((message) => {
            if (message.id !== messageID) return message
            return {
              ...message,
              recipient_count: response.summary.recipient_count,
              delivered_count: response.summary.delivered_count,
              read_count: response.summary.read_count,
              delivered_at: response.summary.delivered_at ?? message.delivered_at,
              read_at: response.summary.read_at ?? message.read_at,
              receipts: response.receipts,
            }
          }),
        )
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [detailsOpen, selectedMessage])

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
            <h2>Messages</h2>
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
        {pendingBusinessShare ? (
          <div className="business-share-picker">
            <div className="business-share-picker-heading">
              <div>
                <span>Share business</span>
                <strong>{pendingBusinessShare.business_name}</strong>
              </div>
              <button
                aria-label="Cancel business share"
                className="icon-button quiet"
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(pendingBusinessShareKey)
                  setPendingBusinessShare(null)
                  setShareError(null)
                }}
              >
                <X size={17} />
              </button>
            </div>
            {shareError ? <span className="business-share-error">{shareError}</span> : null}
            <div className="business-share-targets">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => shareBusinessToConversation(conversation)}
                  disabled={shareBusyConversationID !== null}
                >
                  <ConversationAvatar conversation={conversation} />
                  <span>
                    <strong>{conversationDisplayName(conversation)}</strong>
                    <small>{conversationSubtitle(conversation)}</small>
                  </span>
                  <Send size={16} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {groupComposerOpen ? (
          <form className="group-composer" onSubmit={createGroup}>
            <div className="group-composer-heading">
              <Users size={18} />
              <strong>New circle conversation</strong>
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
              placeholder="Circle name"
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
              <span>{groupBusy ? 'Creating' : 'Create circle'}</span>
            </button>
          </form>
        ) : null}
        <label className="conversation-search">
          <Search size={17} />
          <input
            placeholder="Search"
            value={conversationQuery}
            onChange={(event) => setConversationQuery(event.target.value)}
          />
        </label>
        {chatLoading ? (
          <div className="chat-dock-state">Loading chats</div>
        ) : null}
        {!chatLoading && filteredConversations.length === 0 ? (
          <EmptyState title="Start from Friends" />
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
                <span>{messagePreview(conversation.latest_message)}</span>
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
              </div>
              <div className="chat-header-actions">
                <button
                  aria-label="Conversation details"
                  className="icon-button quiet"
                  title="Conversation details"
                  type="button"
                  onClick={() => {
                    setSelectedMessageID(null)
                    setDetailsOpen(true)
                  }}
                >
                  <Info size={19} />
                </button>
              </div>
            </header>

            <div className="messages-wrap">
              <div
                className="messages"
                ref={messagesRef}
                onScroll={handleMessagesScroll}
              >
                {olderLoadingConversationID === active.id ? (
                  <div className="older-messages-loader">Loading older messages</div>
                ) : null}
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    conversation={active}
                    mine={message.sender_id === user?.id}
                    sender={active.members.find((member) => member.id === message.sender_id)}
                    showSender={active.conversation_type === 'group' && message.sender_id !== user?.id}
                    receipt={message.sender_id === user?.id ? messageReceipt(message) : undefined}
                    onVote={voteBusinessShare}
                    onOpenInfo={() => {
                      setSelectedMessageID(message.id)
                      setDetailsOpen(true)
                    }}
                  />
                ))}
              </div>
              {showScrollToLatest ? (
                <button
                  className="scroll-latest-button"
                  title="Jump to latest message"
                  onClick={() => scrollToLatest()}
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

            {detailsOpen ? (
              <ConversationDetailsPanel
                conversation={active}
                currentUserID={user?.id}
                selectedMessage={selectedMessage}
                onClose={() => {
                  setDetailsOpen(false)
                  setSelectedMessageID(null)
                }}
              />
            ) : null}
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
    ? `@${conversation.other_user.username}`
    : ''
}

function messagePreview(message?: Message) {
  if (!message) return 'No messages yet'
  const sharedBusiness = parseSharedBusinessMessage(message.content)
  if (message.message_type === 'business_share' || sharedBusiness) {
    return sharedBusiness ? `Shared ${sharedBusiness.business_name}` : 'Shared a business'
  }
  if (message.message_type === 'image') return 'Photo'
  if (message.message_type === 'video') return 'Video'
  return message.content ?? 'Message'
}

function parseSharedBusinessMessage(content?: string): SharedBusinessMessage | null {
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as SharedBusinessMessage
    if (!parsed?.business_id || !parsed.title || !parsed.business_name) return null
    return parsed
  } catch {
    return null
  }
}

function mergeMessages(current: Message[], incoming: Message[]) {
  if (current.length === 0) return incoming
  const byID = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) {
    const existing = byID.get(message.id)
    byID.set(message.id, existing ? mergeMessage(existing, message) : message)
  }
  return Array.from(byID.values()).sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  )
}

function mergeMessage(current: Message, incoming: Message): Message {
  return {
    ...current,
    ...incoming,
    receipts: incoming.receipts ?? current.receipts,
    business_vote: incoming.business_vote ?? current.business_vote,
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function RealtimeBadge({ status }: { status: 'Connecting' | 'Live' | 'Reconnecting' }) {
  const online = status === 'Live'
  return (
    <span
      aria-label={status}
      className={online ? 'realtime-badge live' : 'realtime-badge'}
      title={status}
    >
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}
    </span>
  )
}

function MessageBubble({
  conversation,
  message,
  mine,
  onVote,
  sender,
  showSender,
  receipt,
  onOpenInfo,
}: {
  conversation: Conversation
  message: Message
  mine: boolean
  onVote: (messageID: number) => void
  sender?: User
  showSender: boolean
  receipt?: 'sent' | 'delivered' | 'read'
  onOpenInfo: () => void
}) {
  const sharedBusiness = parseSharedBusinessMessage(message.content)

  return (
    <div className={mine ? 'message mine' : 'message'}>
      <div
        className={
          sharedBusiness
            ? 'message-bubble business-share-message'
            : message.media_url
              ? 'message-bubble media'
              : 'message-bubble'
        }
      >
        {showSender ? (
          <strong className="message-sender">{sender?.display_name ?? 'Member'}</strong>
        ) : null}
        {sharedBusiness ? (
          <BusinessShareMessageCard
            business={sharedBusiness}
            conversation={conversation}
            message={message}
            onVote={onVote}
          />
        ) : null}
        {message.media_url && !sharedBusiness ? (
          <div className="message-media">
            {message.message_type === 'video' ? (
              <video controls playsInline preload="metadata" src={message.media_url} />
            ) : (
              <img src={message.media_url} alt="" loading="lazy" decoding="async" />
            )}
          </div>
        ) : null}
        {message.content && !sharedBusiness ? <span className="message-text">{message.content}</span> : null}
        <small className="message-meta">
          <span>{formatShortTime(message.created_at)}</span>
          {receipt ? (
            <MessageReceiptIndicator
              message={message}
              status={receipt}
              onOpenInfo={onOpenInfo}
            />
          ) : null}
        </small>
      </div>
    </div>
  )
}

function BusinessShareMessageCard({
  business,
  conversation,
  message,
  onVote,
}: {
  business: SharedBusinessMessage
  conversation: Conversation
  message: Message
  onVote: (messageID: number) => void
}) {
  const vote = message.business_vote
  const acceptedText = vote?.recommendation_text
  const location = [business.area, business.city].filter(Boolean).join(', ') || business.location
  const participantLabel = conversation.conversation_type === 'group'
    ? `${vote?.participant_count ?? conversation.member_count} members`
    : '2 people'

  return (
    <div className="shared-business-card">
      {business.image_url ? (
        <img src={business.image_url} alt="" loading="lazy" decoding="async" />
      ) : null}
      <div className="shared-business-content">
        <span className="shared-business-type">{business.subcategory ?? business.category}</span>
        <h3>{business.title}</h3>
        <strong>{business.business_name}</strong>
        <div className="shared-business-meta">
          <span><MapPin size={14} /> {business.distance_km ? `${business.distance_km} km` : location}</span>
          {business.price_label ? <span>{business.price_label}</span> : null}
          {business.duration_label ? <span>{business.duration_label}</span> : null}
        </div>
        {business.active_offer_title || business.next_event_title ? (
          <div className="shared-business-signals">
            {business.active_offer_title ? <span>{business.active_offer_title}</span> : null}
            {business.next_event_title ? <span>{business.next_event_title}</span> : null}
          </div>
        ) : null}
        <div className="shared-business-votes">
          <button
            type="button"
            className={vote?.my_vote === 'like' ? 'active' : ''}
            onClick={() => onVote(message.id)}
          >
            <Heart size={17} fill={vote?.my_vote === 'like' ? 'currentColor' : 'none'} />
            <span>{vote?.like_count ?? 0}</span>
          </button>
          <small>{participantLabel}</small>
        </div>
        {acceptedText ? (
          <div className="shared-business-verdict">
            <Check size={16} />
            <span>{acceptedText}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MessageReceiptIndicator({
  message,
  status,
  onOpenInfo,
}: {
  message: Message
  status: 'sent' | 'delivered' | 'read'
  onOpenInfo: () => void
}) {
  const title = receiptTitle(message, status)
  const countLabel =
    message.recipient_count > 1
      ? `${status === 'read' ? message.read_count : message.delivered_count}/${message.recipient_count}`
      : null
  if (status === 'sent') {
    return (
      <button
        aria-label={title}
        className="message-receipt"
        title={title}
        type="button"
        onClick={onOpenInfo}
      >
        <Check size={14} strokeWidth={2.5} />
        {countLabel ? <span>{countLabel}</span> : null}
      </button>
    )
  }

  return (
    <button
      aria-label={title}
      className={
        status === 'read' ? 'message-receipt read' : 'message-receipt delivered'
      }
      title={title}
      type="button"
      onClick={onOpenInfo}
    >
      <CheckCheck size={15} strokeWidth={2.5} />
      {countLabel ? <span>{countLabel}</span> : null}
    </button>
  )
}

function ConversationDetailsPanel({
  conversation,
  currentUserID,
  selectedMessage,
  onClose,
}: {
  conversation: Conversation
  currentUserID?: number
  selectedMessage: Message | null
  onClose: () => void
}) {
  const ownerID = conversation.created_by
  const members = [...(conversation.members ?? [])].sort((first, second) => {
    const firstOwner = first.role === 'owner' || first.id === ownerID
    const secondOwner = second.role === 'owner' || second.id === ownerID
    if (firstOwner !== secondOwner) return firstOwner ? -1 : 1
    return first.display_name.localeCompare(second.display_name)
  })

  return (
    <aside className="chat-details-panel">
      <header>
        <button
          aria-label="Close details"
          className="icon-button quiet"
          type="button"
          onClick={onClose}
        >
          <X size={19} />
        </button>
        <div>
          <span>{selectedMessage ? 'Message info' : 'Conversation info'}</span>
          <h3>{selectedMessage ? messageStatusLabel(selectedMessage) : conversationDisplayName(conversation)}</h3>
        </div>
      </header>

      {selectedMessage ? (
        <MessageInfo message={selectedMessage} members={members} />
      ) : (
        <div className="chat-details-body">
          <div className="group-profile">
            <ConversationAvatar conversation={conversation} />
            <h3>{conversationDisplayName(conversation)}</h3>
            <span>{conversationSubtitle(conversation)}</span>
          </div>

          <section className="details-section">
            <div className="details-section-heading">
              <strong>{conversation.conversation_type === 'group' ? 'Members' : 'Contact'}</strong>
              <span>{members.length}</span>
            </div>
            <div className="member-list">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isCurrentUser={member.id === currentUserID}
                  isOwner={member.role === 'owner' || member.id === ownerID}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}

function MessageInfo({ message, members }: { message: Message; members: User[] }) {
  const receiptMembers = members.filter((member) => member.id !== message.sender_id)
  const receiptsByUserID = new Map(
    (message.receipts ?? [])
      .filter((receipt) => receipt.user_id)
      .map((receipt) => [receipt.user_id, receipt]),
  )
  const memberReceipts = receiptMembers.map((member) => ({
    member,
    receipt: receiptsByUserID.get(member.id),
  }))
  const readBy = memberReceipts.filter((item) => item.receipt?.read_at)
  const deliveredTo = memberReceipts.filter(
    (item) => item.receipt?.delivered_at && !item.receipt.read_at,
  )
  const waitingFor = memberReceipts.filter((item) => !item.receipt?.delivered_at)

  return (
    <div className="chat-details-body">
      <div className="message-info-card">
        <span>{message.content ?? message.message_type}</span>
        <small>{formatLongTime(message.created_at)}</small>
      </div>
      <div className="message-status-summary">
        <span>
          <CheckCheck size={16} />
          Delivered {message.delivered_count}/{message.recipient_count}
        </span>
        <span className={message.read_count > 0 ? 'read' : undefined}>
          <CheckCheck size={16} />
          Seen {message.read_count}/{message.recipient_count}
        </span>
      </div>

      <ReceiptSection title="Read by" items={readBy} timeKey="read_at" />
      <ReceiptSection title="Delivered to" items={deliveredTo} timeKey="delivered_at" />
      <ReceiptSection title="Waiting for" items={waitingFor} />
    </div>
  )
}

function ReceiptSection({
  title,
  items,
  timeKey,
}: {
  title: string
  items: { member: User; receipt?: MessageReceiptItem }[]
  timeKey?: 'delivered_at' | 'read_at'
}) {
  return (
    <section className="details-section">
      <div className="details-section-heading">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      <div className="member-list">
        {items.length === 0 ? (
          <div className="details-empty">No one yet</div>
        ) : (
          items.map(({ member, receipt }) => (
            <MemberRow
              key={member.id}
              member={member}
              meta={timeKey && receipt?.[timeKey] ? formatShortTime(receipt[timeKey]) : 'Not delivered'}
              isOwner={member.role === 'owner'}
            />
          ))
        )}
      </div>
    </section>
  )
}

function MemberRow({
  member,
  isCurrentUser,
  isOwner,
  meta,
}: {
  member: User
  isCurrentUser?: boolean
  isOwner?: boolean
  meta?: string
}) {
  return (
    <div className="member-row">
      <Avatar name={member.display_name} src={member.avatar_url} />
      <span>
        <strong>{isCurrentUser ? `${member.display_name} (You)` : member.display_name}</strong>
        <small>{meta ?? `@${member.username}`}</small>
      </span>
      {isOwner ? (
        <em>
          <Crown size={13} />
          Admin
        </em>
      ) : null}
    </div>
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

function messageStatusLabel(message: Message) {
  const status = messageReceipt(message)
  if (status === 'read') return `Seen by ${message.read_count}/${message.recipient_count}`
  if (status === 'delivered') {
    return `Delivered to ${message.delivered_count}/${message.recipient_count}`
  }
  return `Sent to ${message.recipient_count} recipient${message.recipient_count === 1 ? '' : 's'}`
}

function updateReceiptParticipants(
  message: Message,
  receipt: MessageReceipt,
  type: 'delivered' | 'read',
) {
  if (!message.receipts?.length) return message

  const userIDs =
    type === 'read'
      ? receipt.reader_id
        ? [receipt.reader_id]
        : []
      : receipt.recipient_ids ?? (receipt.recipient_id ? [receipt.recipient_id] : [])
  if (userIDs.length === 0) return message

  const timestamp = type === 'read' ? receipt.read_at : receipt.delivered_at
  if (!timestamp) return message

  return {
    ...message,
    receipts: message.receipts.map((item) => {
      if (!item.user_id || !userIDs.includes(item.user_id)) return item
      return {
        ...item,
        delivered_at: item.delivered_at ?? timestamp,
        read_at: type === 'read' ? item.read_at ?? timestamp : item.read_at,
      }
    }),
  }
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatLongTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
