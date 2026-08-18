export type User = {
  id: number
  email: string
  date_of_birth: string
  account_status: string
  display_name: string
  username: string
  role?: 'owner' | 'member'
  bio?: string
  location?: string
  avatar_url?: string
  avatar_public_id?: string
  cover_url?: string
  cover_public_id?: string
  profile_visibility: 'public' | 'friends' | 'private'
  created_at: string
  updated_at: string
}

export type AuthResponse = {
  access_token: string
  access_token_expires_at: string
  refresh_token: string
  refresh_token_expires_at: string
  user: User
}

export type BusinessAccount = {
  id: number
  email: string
  business_name: string
  business_category: string
  business_subcategory?: string
  location: string
  address?: string
  city?: string
  area?: string
  latitude?: number
  longitude?: number
  service_radius_km?: number
  price_range?: 'budget' | 'moderate' | 'premium' | 'luxury'
  mood_tags?: string
  service_tags?: string
  best_for?: string
  website_url?: string
  whatsapp_number?: string
  contact_phone?: string
  description?: string
  offerings?: string
  opening_hours?: string
  onboarding_status: 'draft' | 'submitted' | 'approved'
  account_status: 'active' | 'disabled'
  created_at: string
  updated_at: string
}

export type BusinessAuthResponse = {
  access_token: string
  access_token_expires_at: string
  business: BusinessAccount
}

export type BusinessBookingRequest = {
  id: number
  requester_name: string
  requester_contact?: string
  booking_note?: string
  booking_time?: string
  status: 'pending' | 'confirmed' | 'declined' | 'completed'
  created_at: string
  updated_at: string
}

export type BusinessDashboard = {
  today_update?: string
  today_highlight?: string
  offer_title?: string
  offer_details?: string
  offer_valid_until?: string
  offer_status: 'draft' | 'active' | 'paused'
  offer_clicks: number
  profile_visits: number
  booking_clicks: number
  direction_clicks: number
  saves: number
  updated_at: string
  bookings: BusinessBookingRequest[]
}

export type PostMediaInput = {
  media_type: 'image' | 'video'
  cloudinary_public_id: string
  secure_url: string
  thumbnail_url?: string
  width?: number
  height?: number
  duration_seconds?: number
  display_order: number
}

export type PostMedia = PostMediaInput & {
  id: number
}

export type Post = {
  id: number
  author_id: number
  author?: User
  content?: string
  visibility: 'public' | 'friends' | 'private'
  shared_post_id?: number
  created_at: string
  updated_at: string
  media: PostMedia[] | null
  like_count: number
  comment_count: number
  share_count: number
  viewer_reaction?: string
  shared_post?: Post
}

export type Comment = {
  id: number
  post_id: number
  author_id: number
  author?: User
  content: string
  created_at: string
  updated_at: string
}

export type FriendRequest = {
  id: number
  sender_id: number
  receiver_id: number
  sender?: User
  receiver?: User
  status: string
  created_at: string
  updated_at: string
}

export type FriendSuggestion = {
  user: User
  mutual_friend_count: number
  reason: string
}

export type Message = {
  id: number
  conversation_id: number
  sender_id: number
  message_type: 'text' | 'image' | 'video'
  content?: string
  media_url?: string
  media_public_id?: string
  delivered_at?: string
  read_at?: string
  recipient_count: number
  delivered_count: number
  read_count: number
  receipts?: MessageReceipt[]
  created_at: string
}

export type MessageReceipt = {
  message_id: number
  user_id?: number
  user?: User
  delivered_at?: string
  read_at?: string
  recipient_count: number
  delivered_count: number
  read_count: number
}

export type Conversation = {
  id: number
  user_one_id?: number
  user_two_id?: number
  conversation_type: 'direct' | 'group'
  title?: string
  created_by?: number
  other_user?: User
  members: User[]
  member_count: number
  latest_message?: Message
  created_at: string
  updated_at: string
}

export type NotificationItem = {
  id: number
  user_id: number
  actor_id?: number
  notification_type: string
  entity_type?: string
  entity_id?: number
  read_at?: string
  created_at: string
}

export type CloudinarySignature = {
  cloud_name: string
  api_key: string
  folder: string
  timestamp: string
  signature: string
  allowed_mime_prefixes: string[]
  max_image_bytes: number
  max_video_bytes: number
  max_video_seconds: number
}
