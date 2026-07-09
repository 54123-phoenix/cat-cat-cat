export interface Cat {
  id: number
  name: string
  nickname?: string
  gender?: string
  neutered?: string
  age_estimate?: string
  color?: string
  personality?: string
  story?: string
  location?: string
  avatar?: string
  personality_radar?: number[]
  quote?: string
  aliases?: string
  aliases_list?: string[]
  relationships?: string
  relationships_list?: Relationship[]
  created_at: string
  images: CatImage[]
  health_records: HealthRecord[]
}

export interface Relationship {
  cat_id: number
  cat_name: string
  type: string
}

export interface CatImage {
  id: number
  cat_id: number
  image_path: string
  created_at: string
}

export interface CatListItem {
  id: number
  name: string
  nickname?: string
  gender?: string
  age_estimate?: string
  color?: string
  location?: string
  avatar?: string
  created_at: string
}

export interface Sighting {
  id: number
  cat_id: number
  location?: string
  latitude?: number
  longitude?: number
  confidence?: number
  activity_type?: string
  note?: string
  weather?: string
  mood?: string
  image_path?: string
  spotted_by?: string
  location_name?: string
  confirmations: number
  grade: string
  status?: string
  created_at: string
  cat?: CatListItem
}

export interface Post {
  id: number
  userId: number
  user?: UserBrief
  topic: string
  content: string
  tags: string[]
  images: string[]
  relatedCat?: { id: number; name: string }
  likes: number
  liked: boolean
  comments: number
  status: string
  createdAt: string
  postType: string
  pollOptions: string[]
  pollData: number[]
  acceptedCommentId?: number
}

export interface Comment {
  id: number
  postId: number
  userId: number
  user?: UserBrief
  content: string
  createdAt: string
  accepted: boolean
}

export interface UserBrief {
  id: number
  nickname: string
  avatar?: string
}

export interface UserProfile {
  id: number
  username: string
  nickname: string
  role: string
  avatar?: string
  created_at: string
  stats: UserStats
  badges: UserBadgeItem[]
}

export interface UserStats {
  sightings: number
  posts: number
  discoveries: number
  approved_discoveries: number
  cats_known: number
  badges_count: number
  total_badges: number
  locations_count: number
  photos_count: number
  contribution_score: number
  primary_contribution?: string
  contribution_breakdown: ContributionStat[]
}

export interface ContributionStat {
  key: string
  label: string
  score: number
  current: number
  target: number
  description: string
}

export interface UserBadgeItem {
  badge_key: string
  earned: boolean
  earned_at?: string
}

export interface BadgeDetail {
  badge_key: string
  name: string
  emoji: string
  description: string
  series: string
  series_name: string
  color: string
  condition_text: string
  order: number
  type: string
  earned: boolean
  earned_at?: string
  progress_current: number
  progress_total: number
}

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  content?: string
  related_id?: number
  related_type?: string
  is_read: boolean
  created_at: string
}

export interface HealthRecord {
  id: number
  cat_id: number
  record_type: string
  title: string
  description?: string
  record_date: string
  location?: string
  status: string
  created_at: string
}

export interface FeedingPoint {
  id: number
  name: string
  description?: string
  latitude: number
  longitude: number
  is_active: string
  created_at: string
}

export interface Discovery {
  id: number
  image_path?: string
  location_name?: string
  latitude?: number
  longitude?: number
  note?: string
  status: string
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  has_more: boolean
}

export interface RecognizeResult {
  status: string
  cat_id?: number
  cat_name?: string
  name?: string
  confidence: number
  candidates: RecognizeCandidate[]
  personality_tags?: string[]
  campus_zone?: string
  collector_status?: string
}

export interface RecognizeCandidate {
  cat_id: number
  cat_name: string
  confidence: number
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'
export type HealthCheckStatus = 'pass' | 'warn' | 'fail' | 'skip'

export interface HealthCheckItem {
  name: string
  status: HealthCheckStatus
  detail: string
  metadata: Record<string, unknown>
}

export interface ModelHealth {
  status: HealthStatus
  runtime_available: boolean
  model_file: Record<string, unknown>
  embeddings_file: Record<string, unknown>
  reference_cat_count: number
  embedding_dimensions: number[]
  thresholds: {
    confirmed: number
    uncertain: number
    valid: boolean
  }
  warm_model_requested: boolean
  warm_model_loaded: boolean
  checked_at: string
  checks: HealthCheckItem[]
}

export interface SystemHealth {
  service: string
  status: HealthStatus
  model: ModelHealth
  checked_at: string
}

export interface HeatmapPoint {
  name: string
  latitude: number
  longitude: number
  count: number
}

export interface DailyCapsuleCat {
  id: number
  name: string
  nickname?: string
  avatar?: string
  color?: string
  location?: string
  quote?: string
  personality_tags: string[]
  sighting_count: number
}

export interface DailyCapsule {
  available: boolean
  message?: string
  date?: string
  cat?: DailyCapsuleCat
  reward?: { sticker: string; title: string; route_hint: string | null }
  latest_sighting_at?: string
}

export interface ContributionTitle {
  key: string
  label: string
  label_en: string
  count: number
  description: string
}

export interface ContributionTitlesResult {
  titles: ContributionTitle[]
  primary_title: ContributionTitle | null
  total: number
}

export interface RouteStoryStop {
  name: string
  reason: string
  cat_id: number
  cat_name: string
  cat_avatar?: string
  cat_color?: string
  latitude?: number
  longitude?: number
  sightings_count: number
  latest_sighting_at: string
  clue: string
  confidence: number
  time_window: string
  checked_in: boolean
}

export interface RouteStory {
  title: string
  time_slot: string
  generated_at: string
  share_path: string
  stops: RouteStoryStop[]
  route_stamp: { name: string; time_slot: string; stop_count: number; emoji: string }
  story_intro: string
}

export interface Collectible {
  id: number
  type: string
  key: string
  display_name: string
  emoji?: string
  created_at: string
}

export interface CollectiblesResult {
  collectibles: Collectible[]
  total: number
}

export interface DailyCapsuleClaimResult {
  claimed: boolean
  message?: string
  claim?: {
    cat_id?: number
    cat_name?: string
    sticker?: string
    title?: string
    claim_date: string
  }
}

export interface DailyGachaCat {
  id: number
  name: string
  nickname?: string
  avatar?: string
  color?: string
  location?: string
  quote?: string
}

export interface DailyGachaPrize {
  key: string
  title: string
  base_title: string
  emoji: string
  rarity: 'common' | 'rare' | 'epic' | string
  rarity_label: string
  fortune: string
  action_hint: string
  share_text: string
  cat: DailyGachaCat
}

export interface DailyGacha {
  available: boolean
  date?: string
  drawn: boolean
  newly_drawn?: boolean
  seed_tag?: string
  message?: string
  prize?: DailyGachaPrize
  collectible?: Collectible
}

export interface RouteCheckInResult {
  checked_in: boolean
  message?: string | null
  stop_name?: string
  total_checkins?: number
  total_stops?: number
  completed?: boolean
  has_stamp?: boolean
  stamp_issued?: boolean
}

export interface RouteProgressResult {
  time_slot: string
  checked_stops: string[]
  checkin_count: number
  total_stops: number
  remaining_stops: number
  completed: boolean
  has_stamp: boolean
}
