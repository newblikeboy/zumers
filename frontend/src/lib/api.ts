import type {
  AuthResponse,
  BusinessAccount,
  BusinessAuthResponse,
  BusinessClaimRequest,
  BusinessDashboard,
  BusinessDashboardUpdate,
  BusinessDuplicateCheckResponse,
  BusinessBookingRequest,
  BusinessLikeResponse,
  BusinessShareVoteSummary,
  BusinessMedia,
  BusinessTaxonomy,
  BusinessVenueExperience,
  CloudinarySignature,
  Conversation,
  Comment,
  DiscoverySearchResponse,
  FriendRequest,
  FriendSuggestion,
  Message,
  NotificationItem,
  Post,
  PostMediaInput,
  User,
} from './types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'
const businessAccessTokenKey = 'zumers.businessAccessToken'

type TokenStore = {
  accessToken: string | null
  refreshToken: string | null
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void
  clear: () => void
}

let tokenStore: TokenStore | null = null

export function configureApiTokens(store: TokenStore) {
  tokenStore = store
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (tokenStore?.accessToken) {
    headers.set('Authorization', `Bearer ${tokenStore.accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && retry && tokenStore?.refreshToken) {
    const refreshed = await refreshSession(tokenStore.refreshToken)
    tokenStore.setTokens({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
    })
    return apiRequest<T>(path, options, false)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Request failed')
  }

  return data as T
}

export const api = {
  signup: (body: {
    email: string
    password: string
    date_of_birth: string
    display_name: string
    username: string
  }) =>
    apiRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: (refreshToken: string) =>
    apiRequest<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  me: () => apiRequest<User>('/me'),

  updateProfile: (body: Partial<User>) =>
    apiRequest<User>('/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  searchUsers: (query: string) =>
    apiRequest<{ users: User[] }>(
      `/users/search?q=${encodeURIComponent(query)}`,
    ),

  viewProfile: (id: number) => apiRequest<User>(`/users/${id}`),

  sendFriendRequest: (receiverId: number) =>
    apiRequest<FriendRequest>('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: receiverId }),
    }),

  friendRequests: (direction?: 'outgoing') =>
    apiRequest<{ friend_requests: FriendRequest[] }>(
      `/friends/requests${direction ? '?direction=outgoing' : ''}`,
    ),

  acceptFriendRequest: (id: number) =>
    apiRequest<{ status: string }>(`/friends/requests/${id}/accept`, {
      method: 'POST',
    }),

  rejectFriendRequest: (id: number) =>
    apiRequest<{ status: string }>(`/friends/requests/${id}/reject`, {
      method: 'POST',
    }),

  friends: () => apiRequest<{ friends: User[] }>('/friends'),

  friendSuggestions: () =>
    apiRequest<{ suggestions: FriendSuggestion[] }>('/friends/suggestions'),

  unfriend: (id: number) =>
    apiRequest<void>(`/friends/${id}`, {
      method: 'DELETE',
    }),

  createPost: (body: {
    content?: string
    visibility: 'public' | 'friends' | 'private'
    media: PostMediaInput[]
  }) =>
    apiRequest<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  feed: () => apiRequest<{ posts: Post[] }>('/feed'),

  reels: () => apiRequest<{ posts: Post[] }>('/reels'),

  userPosts: (id: number) => apiRequest<{ posts: Post[] }>(`/users/${id}/posts`),

  deletePost: (id: number) =>
    apiRequest<void>(`/posts/${id}`, {
      method: 'DELETE',
    }),

  reactToPost: (id: number, reactionType = 'like') =>
    apiRequest<Post>(`/posts/${id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ reaction_type: reactionType }),
    }),

  removePostReaction: (id: number) =>
    apiRequest<Post>(`/posts/${id}/reactions`, {
      method: 'DELETE',
    }),

  likeBusiness: (id: number) =>
    apiRequest<BusinessLikeResponse>(`/businesses/${id}/like`, {
      method: 'POST',
    }),

  removeBusinessLike: (id: number) =>
    apiRequest<BusinessLikeResponse>(`/businesses/${id}/like`, {
      method: 'DELETE',
    }),

  createBusinessBooking: (
    id: number,
    body: {
      requester_name: string
      requester_contact?: string
      booking_note?: string
      booking_time?: string
    },
  ) =>
    apiRequest<BusinessBookingRequest>(`/businesses/${id}/bookings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  comments: (id: number) =>
    apiRequest<{ comments: Comment[] }>(`/posts/${id}/comments`),

  createComment: (id: number, content: string) =>
    apiRequest<Comment>(`/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (id: number) =>
    apiRequest<void>(`/comments/${id}`, {
      method: 'DELETE',
    }),

  sharePost: (
    id: number,
    body: { content?: string; visibility: 'public' | 'friends' | 'private' },
  ) =>
    apiRequest<Post>(`/posts/${id}/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  signUpload: () =>
    apiRequest<CloudinarySignature>('/media/sign-upload', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  conversations: () =>
    apiRequest<{ conversations: Conversation[] }>('/conversations'),

  createConversation: (friendId: number) =>
    apiRequest<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ friend_id: friendId }),
    }),

  createGroupConversation: (body: { title: string; member_ids: number[] }) =>
    apiRequest<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  messages: (conversationId: number) =>
    apiRequest<{ messages: Message[] }>(
      `/conversations/${conversationId}/messages`,
    ),

  sendMessage: (
    conversationId: number,
    body: {
      message_type: 'text' | 'image' | 'video'
      content?: string
      media_url?: string
      media_public_id?: string
    },
  ) =>
    apiRequest<Message>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  sendBusinessShare: (conversationId: number, content: string) =>
    apiRequest<Message>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message_type: 'business_share', content }),
    }),

  voteBusinessShare: (messageId: number, vote: 'like' | 'dislike') =>
    apiRequest<BusinessShareVoteSummary>(`/messages/${messageId}/business-vote`, {
      method: 'POST',
      body: JSON.stringify({ vote }),
    }),

  markConversationRead: (conversationId: number) =>
    apiRequest<{ status: string }>(`/conversations/${conversationId}/read`, {
      method: 'POST',
    }),

  notifications: () =>
    apiRequest<{ notifications: NotificationItem[] }>('/notifications'),

  markNotificationRead: (id: number) =>
    apiRequest<{ status: string }>(`/notifications/${id}/read`, {
      method: 'POST',
    }),

  discoverySearch: (params: {
    query?: string
    chips?: string[]
    latitude?: number
    longitude?: number
    limit?: number
  }) => {
    const query = new URLSearchParams()
    if (params.query) query.set('q', params.query)
    if (params.chips?.length) query.set('chips', params.chips.join(','))
    if (typeof params.latitude === 'number') query.set('latitude', String(params.latitude))
    if (typeof params.longitude === 'number') query.set('longitude', String(params.longitude))
    if (params.limit) query.set('limit', String(params.limit))
    return apiRequest<DiscoverySearchResponse>(`/discovery/search?${query.toString()}`)
  },
}

async function businessApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = localStorage.getItem(businessAccessTokenKey)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'Request failed')
  }

  return data as T
}

function storeBusinessSession(response: BusinessAuthResponse) {
  localStorage.setItem(businessAccessTokenKey, response.access_token)
  return response
}

export const businessApi = {
  signup: (body: {
    email: string
    password: string
    business_name: string
    business_category: string
    business_subcategory?: string
    location?: string
    city?: string
    area?: string
    google_place_id?: string
    contact_phone?: string
  }) =>
    businessApiRequest<BusinessAuthResponse>('/business/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(storeBusinessSession),

  login: (body: { email: string; password: string }) =>
    businessApiRequest<BusinessAuthResponse>('/business/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(storeBusinessSession),

  me: () => businessApiRequest<BusinessAccount>('/business/me'),

  duplicateCheck: (body: {
    business_name?: string
    location?: string
    city?: string
    area?: string
    google_place_id?: string
  }) =>
    businessApiRequest<BusinessDuplicateCheckResponse>('/business/duplicate-check', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createClaim: (body: {
    existing_business_id: number
    claimant_name?: string
    claimant_phone?: string
    claimant_note?: string
    evidence_url?: string
    match_source?: 'google_place_id' | 'name_location' | 'manual'
  }) =>
    businessApiRequest<BusinessClaimRequest>('/business/claims', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (body: Partial<BusinessAccount> & {
    business_media?: BusinessMedia[]
    venue_experiences?: BusinessVenueExperience[]
    venue_media?: BusinessMedia[]
  }) =>
    businessApiRequest<BusinessAccount>('/business/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  dashboard: () => businessApiRequest<BusinessDashboard>('/business/dashboard'),

  updateDashboard: (body: BusinessDashboardUpdate) =>
    businessApiRequest<BusinessDashboard>('/business/dashboard', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  logout: () => {
    localStorage.removeItem(businessAccessTokenKey)
  },

  taxonomy: () => businessApiRequest<BusinessTaxonomy>('/business/taxonomy'),

  signUpload: () =>
    businessApiRequest<CloudinarySignature>('/business/media/sign-upload', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    tokenStore?.clear()
    throw new Error(data?.error ?? 'Session expired')
  }
  return data as AuthResponse
}
