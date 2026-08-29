import { api } from './api'
import type { Conversation, User } from './types'

const chatDataCacheMaxAgeMs = 2 * 60 * 1000
const chatConversationsCachePrefix = 'zumers.chat.conversations.'
const chatFriendsCachePrefix = 'zumers.chat.friends.'

let chatDataRequest:
  | {
      promise: Promise<{ conversations: Conversation[]; friends: User[] }>
      userID: number
    }
  | null = null

function readCachedList<T>(key: string) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { items?: T[]; savedAt?: number }
    if (
      !Array.isArray(parsed.items) ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > chatDataCacheMaxAgeMs
    ) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.items
  } catch {
    sessionStorage.removeItem(key)
    return null
  }
}

function writeCachedList<T>(key: string, items: T[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ items, savedAt: Date.now() }))
  } catch {
    // Cache failure should not block chat.
  }
}

export function readCachedChatConversations(userID?: number) {
  if (!userID) return null
  return readCachedList<Conversation>(`${chatConversationsCachePrefix}${userID}`)
}

export function readCachedChatFriends(userID?: number) {
  if (!userID) return null
  return readCachedList<User>(`${chatFriendsCachePrefix}${userID}`)
}

export function writeCachedChatConversations(userID: number | undefined, conversations: Conversation[]) {
  if (!userID) return
  writeCachedList(`${chatConversationsCachePrefix}${userID}`, conversations)
}

export function writeCachedChatFriends(userID: number | undefined, friends: User[]) {
  if (!userID) return
  writeCachedList(`${chatFriendsCachePrefix}${userID}`, friends)
}

function readCachedChatData(userID: number) {
  const conversations = readCachedChatConversations(userID)
  const friends = readCachedChatFriends(userID)
  if (!conversations || !friends) return null
  return { conversations, friends }
}

export function preloadChatData(userID?: number) {
  if (!userID) return Promise.resolve({ conversations: [], friends: [] })
  const cached = readCachedChatData(userID)
  if (cached) return Promise.resolve(cached)
  if (chatDataRequest?.userID === userID) return chatDataRequest.promise

  const promise = Promise.all([api.conversations(), api.friends()])
    .then(([conversationResponse, friendResponse]) => {
      writeCachedChatConversations(userID, conversationResponse.conversations)
      writeCachedChatFriends(userID, friendResponse.friends)
      return {
        conversations: conversationResponse.conversations,
        friends: friendResponse.friends,
      }
    })
    .finally(() => {
      if (chatDataRequest?.userID === userID) {
        chatDataRequest = null
      }
    })

  chatDataRequest = { userID, promise }
  return promise
}
