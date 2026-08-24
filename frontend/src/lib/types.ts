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
  postal_code?: string
  google_place_id?: string
  state?: string
  country?: string
  district?: string
  landmark?: string
  latitude?: number
  longitude?: number
  location_accuracy_meters?: number
  location_verified: boolean
  verification_level?: BusinessVerificationLevel
  service_radius_km?: number
  price_range?: 'budget' | 'moderate' | 'premium' | 'luxury'
  mood_tags?: string
  service_tags?: string
  best_for?: string
  facility_tags?: string
  website_url?: string
  whatsapp_number?: string
  contact_phone?: string
  description?: string
  offerings?: string
  opening_hours?: string
  opening_hours_schedule: BusinessOpeningHour[]
  open_now: boolean
  media: BusinessMedia[]
  primary_venue?: BusinessVenue
  onboarding_status: 'draft' | 'submitted' | 'approved'
  account_status: 'active' | 'disabled'
  created_at: string
  updated_at: string
}

export type BusinessVenue = {
  id: number
  business_id: number
  venue_name: string
  is_primary: boolean
  location: string
  address?: string
  city?: string
  area?: string
  postal_code?: string
  google_place_id?: string
  state?: string
  country?: string
  district?: string
  landmark?: string
  latitude?: number
  longitude?: number
  location_accuracy_meters?: number
  location_verified: boolean
  verification_level?: BusinessVerificationLevel
  service_radius_km?: number
  opening_hours?: string
  status: 'active' | 'inactive'
  media: BusinessMedia[]
  experiences: BusinessVenueExperience[]
}

export type BusinessMedia = {
  id?: number
  media_type: 'image' | 'video'
  purpose: 'cover' | 'gallery' | 'food' | 'activity' | 'menu' | 'video'
  cloudinary_public_id: string
  secure_url: string
  thumbnail_url?: string
  width?: number
  height?: number
  duration_seconds?: number
  alt_text?: string
  display_order: number
  status?: 'active' | 'hidden'
}

export type BusinessVenueExperience = {
  id?: number
  venue_id?: number
  experience_name: string
  description?: string
  category?: string
  tags?: string
  starting_price?: number
  average_price_per_person?: number
  typical_duration_minutes?: number
  min_group_size?: number
  ideal_group_size?: number
  max_group_size?: number
  indoor_outdoor?: 'indoor' | 'outdoor' | 'both'
  booking_required: boolean
  walk_in_available: boolean
  status?: 'draft' | 'active' | 'inactive'
  display_order: number
  media?: BusinessMedia[]
}

export type BusinessOpeningHour = {
  weekday: number
  interval_order: number
  is_closed: boolean
  opens_at?: string
  closes_at?: string
}

export type BusinessVerificationLevel =
  | 'unverified'
  | 'phone_verified'
  | 'location_verified'
  | 'ownership_verified'
  | 'zumers_verified'

export type BusinessDuplicateMatch = {
  business_id: number
  business_name: string
  business_category: string
  location: string
  city?: string
  area?: string
  google_place_id?: string
  verification_level: BusinessVerificationLevel
  match_type: 'google_place_id' | 'name_location'
  claim_available: boolean
}

export type BusinessDuplicateCheckResponse = {
  matches: BusinessDuplicateMatch[]
  exact_match: boolean
}

export type BusinessClaimRequest = {
  id: number
  existing_business_id: number
  claimant_business_id: number
  claimant_name?: string
  claimant_phone?: string
  claimant_note?: string
  evidence_url?: string
  match_source: 'google_place_id' | 'name_location' | 'manual'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewed_at?: string
  created_at: string
  updated_at: string
}

export type BusinessAuthResponse = {
  access_token: string
  access_token_expires_at: string
  business: BusinessAccount
}

export type BusinessTaxonomySubcategory = {
  id: number
  slug: string
  name: string
}

export type BusinessTaxonomyCategory = {
  id: number
  slug: string
  name: string
  description?: string
  subcategories: BusinessTaxonomySubcategory[]
}

export type BusinessTaxonomyTag = {
  id: number
  type: 'mood' | 'service' | 'audience' | 'facility'
  slug: string
  name: string
}

export type BusinessTaxonomy = {
  categories: BusinessTaxonomyCategory[]
  tags: BusinessTaxonomyTag[]
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

export type BusinessOffer = {
  id: number
  business_id: number
  venue_id?: number
  title: string
  description?: string
  original_price?: number
  offer_price?: number
  discount_percent?: number
  discount_amount?: number
  starts_on?: string
  ends_on?: string
  starts_at?: string
  ends_at?: string
  applicable_days?: string
  terms?: string
  target_audience?: string
  status: 'draft' | 'active' | 'paused' | 'expired'
  click_count: number
  created_at: string
  updated_at: string
}

export type BusinessEvent = {
  id: number
  business_id: number
  venue_id?: number
  title: string
  description?: string
  event_type?: string
  starts_at?: string
  ends_at?: string
  price_min?: number
  price_max?: number
  booking_required: boolean
  target_audience?: string
  terms?: string
  status: 'draft' | 'scheduled' | 'active' | 'cancelled' | 'completed'
  created_at: string
  updated_at: string
}

export type BusinessDashboard = {
  offer_id?: number
  today_update?: string
  today_highlight?: string
  offer_title?: string
  offer_details?: string
  offer_valid_until?: string
  offer_status: 'draft' | 'active' | 'paused' | 'expired'
  offer_clicks: number
  profile_visits: number
  booking_clicks: number
  direction_clicks: number
  saves: number
  updated_at: string
  bookings: BusinessBookingRequest[]
  offers?: BusinessOffer[]
  events?: BusinessEvent[]
}

export type BusinessDashboardUpdate = Partial<BusinessDashboard> & {
  event_id?: number
  event_title?: string
  event_details?: string
  event_type?: string
  event_starts_at?: string
  event_ends_at?: string
  event_status?: BusinessEvent['status']
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
