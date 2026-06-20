from datetime import datetime
from typing import Optional, List
import json
from pydantic import BaseModel, field_validator, model_validator, constr, confloat
from typing import Literal


class CatImageBase(BaseModel):
    image_path: str


class CatImageCreate(CatImageBase):
    pass


class CatImageResponse(CatImageBase):
    id: int
    cat_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CatBase(BaseModel):
    name: str
    nickname: Optional[str] = None
    gender: Optional[str] = None
    neutered: Optional[str] = None
    age_estimate: Optional[str] = None
    color: Optional[str] = None
    personality: Optional[str] = None
    story: Optional[str] = None
    location: Optional[str] = None
    avatar: Optional[str] = None
    personality_radar: Optional[str] = None
    quote: Optional[str] = None
    aliases: Optional[str] = None
    relationships: Optional[str] = None


class CatCreate(CatBase):
    name: constr(min_length=1, max_length=50)
    personality: Optional[constr(max_length=200)] = None
    story: Optional[constr(max_length=2000)] = None
    location: Optional[constr(max_length=100)] = None


class CatUpdate(CatBase):
    name: Optional[str] = None


class CatResponse(CatBase):
    id: int
    created_at: datetime
    images: List[CatImageResponse] = []
    health_records: List = []
    personality_radar: Optional[List[int]] = None
    aliases_list: List[str] = []
    relationships_list: List[dict] = []

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def _from_orm_cat(cls, data):
        if hasattr(data, "aliases"):
            aliases_raw = getattr(data, "aliases", None) or ""
            rel_raw = getattr(data, "relationships", None) or ""
            radar_raw = getattr(data, "personality_radar", None)
            d = {
                "id": data.id,
                "name": data.name,
                "nickname": data.nickname,
                "gender": data.gender,
                "neutered": data.neutered,
                "age_estimate": data.age_estimate,
                "color": data.color,
                "personality": data.personality,
                "story": data.story,
                "location": data.location,
                "avatar": data.avatar,
                "personality_radar": radar_raw,
                "quote": getattr(data, "quote", None),
                "aliases": aliases_raw,
                "relationships": rel_raw,
                "created_at": data.created_at,
            }
            try:
                d["personality_radar"] = json.loads(radar_raw) if radar_raw else None
            except (json.JSONDecodeError, TypeError):
                d["personality_radar"] = None
            d["aliases_list"] = [a for a in aliases_raw.split(",") if a.strip()] if aliases_raw else []
            try:
                d["relationships_list"] = json.loads(rel_raw) if rel_raw else []
            except (json.JSONDecodeError, TypeError):
                d["relationships_list"] = []
            images = getattr(data, "images", None) or []
            d["images"] = images
            d["health_records"] = getattr(data, "health_records", []) or []
            return d
        return data


class CatListResponse(BaseModel):
    id: int
    name: str
    nickname: Optional[str] = None
    gender: Optional[str] = None
    age_estimate: Optional[str] = None
    color: Optional[str]
    location: Optional[str]
    avatar: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SightingBase(BaseModel):
    cat_id: int
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    confidence: Optional[float] = None
    activity_type: Optional[str] = None
    note: Optional[str] = None
    weather: Optional[str] = None
    mood: Optional[str] = None


class SightingCreate(SightingBase):
    latitude: Optional[confloat(ge=-90, le=90)] = None
    longitude: Optional[confloat(ge=-180, le=180)] = None
    note: Optional[constr(max_length=500)] = None


class SightingReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    reject_reason: Optional[str] = None


class SightingResponse(SightingBase):
    id: int
    image_path: Optional[str]
    activity_type: Optional[str] = None
    note: Optional[str] = None
    spotted_by: Optional[str] = None
    location_name: Optional[str] = None
    confirmations: int = 0
    grade: str = "casual"
    weather: Optional[str] = None
    mood: Optional[str] = None
    created_at: datetime
    cat: Optional[CatListResponse] = None

    class Config:
        from_attributes = True


class SightingListItem(BaseModel):
    id: int
    cat_id: int
    image_path: Optional[str] = None
    location: Optional[str] = None
    location_name: Optional[str] = None
    confidence: Optional[float] = None
    activity_type: Optional[str] = None
    note: Optional[str] = None
    status: str = "pending"
    confirmations: int = 0
    grade: str = "casual"
    weather: Optional[str] = None
    mood: Optional[str] = None
    created_at: datetime
    cat: Optional[CatListResponse] = None
    spotted_by: Optional[str] = None

    class Config:
        from_attributes = True


class SightingVoteRequest(BaseModel):
    cat_id: int


class SightingConfirmResponse(BaseModel):
    sighting_id: int
    confirmations: int
    grade: str


class SightingVoteResponse(BaseModel):
    sighting_id: int
    votes: dict
    auto_confirmed: bool = False
    grade: str = "casual"


class RecognizeCandidate(BaseModel):
    cat_id: int
    cat_name: str
    confidence: float


class RecognizeResponse(BaseModel):
    status: str = "unknown"
    cat_id: Optional[int] = None
    cat_name: Optional[str] = None
    name: Optional[str] = None
    confidence: float = 0.0
    candidates: List[RecognizeCandidate] = []


class HeatmapPoint(BaseModel):
    name: str
    latitude: float
    longitude: float
    count: int


class UserStats(BaseModel):
    sightings: int = 0
    posts: int = 0
    discoveries: int = 0
    approved_discoveries: int = 0
    cats_known: int = 0
    badges_count: int = 0
    total_badges: int = 12
    locations_count: int = 0
    photos_count: int = 0


class UserBadgeItem(BaseModel):
    badge_key: str
    earned: bool = False
    earned_at: Optional[datetime] = None


class UserProfile(BaseModel):
    id: int
    username: str
    nickname: str
    role: str
    avatar: Optional[str]
    created_at: datetime
    stats: UserStats = UserStats()
    badges: List[UserBadgeItem] = []

    class Config:
        from_attributes = True


class UserRegister(BaseModel):
    username: constr(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_\-]+$")
    password: constr(min_length=6, max_length=128)
    nickname: constr(min_length=1, max_length=50)


class UserLogin(BaseModel):
    username: constr(min_length=1, max_length=50)
    password: constr(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: UserProfile


class UserBrief(BaseModel):
    id: int
    nickname: str
    avatar: Optional[str] = None

    class Config:
        from_attributes = True


class RelatedCatResponse(BaseModel):
    id: int
    name: str


class PostCreate(BaseModel):
    topic: str = "daily"
    content: constr(min_length=1, max_length=500)
    tags: List[str] = []
    relatedCatId: Optional[int] = None
    postType: str = "discussion"
    pollOptions: List[str] = []


class PostResponse(BaseModel):
    id: int
    userId: int
    user: Optional[UserBrief] = None
    topic: str
    content: str
    tags: List[str] = []
    images: List[str] = []
    relatedCat: Optional[RelatedCatResponse] = None
    likes: int = 0
    liked: bool = False
    comments: int = 0
    status: str = "normal"
    createdAt: str
    postType: str = "discussion"
    pollOptions: List[str] = []
    pollData: List[int] = []
    acceptedCommentId: Optional[int] = None


class PostUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    relatedCatId: Optional[int] = None


class CommentCreate(BaseModel):
    content: constr(min_length=1, max_length=300)


class CommentResponse(BaseModel):
    id: int
    postId: int
    userId: int
    user: Optional[UserBrief] = None
    content: str
    createdAt: str
    accepted: bool = False


class ReportCreate(BaseModel):
    reason: constr(min_length=1, max_length=200)


class ReportResponse(BaseModel):
    id: int
    postId: int
    post_title: str = ""
    reported_by: int
    reason: str
    status: str
    created_at: datetime


class BadgeDefine(BaseModel):
    badge_key: str
    name: str
    emoji: str
    description: str
    series: str
    series_name: str
    color: str
    condition_text: str
    order: int
    type: str


class BadgeDetail(BaseModel):
    badge_key: str
    name: str
    emoji: str
    description: str
    series: str
    series_name: str
    color: str
    condition_text: str
    order: int
    type: str
    earned: bool = False
    earned_at: Optional[datetime] = None
    progress_current: int = 0
    progress_total: int = 1


class DiscoveryReview(BaseModel):
    action: Literal["approve", "reject"]
    name: Optional[constr(max_length=50)] = None
    color: Optional[constr(max_length=50)] = None
    note: Optional[constr(max_length=500)] = None
    cat_id: Optional[int] = None


class DiscoveryResponse(BaseModel):
    id: int
    image_path: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    note: Optional[str] = None
    status: str = "pending"
    created_at: datetime

    class Config:
        from_attributes = True


class HealthRecordCreate(BaseModel):
    record_type: constr(min_length=1, max_length=20)
    title: constr(min_length=1, max_length=100)
    description: Optional[constr(max_length=1000)] = None
    record_date: datetime
    location: Optional[constr(max_length=100)] = None
    status: str = "completed"


class HealthRecordResponse(BaseModel):
    id: int
    cat_id: int
    record_type: str
    title: str
    description: Optional[str]
    record_date: datetime
    location: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class FeedingPointCreate(BaseModel):
    name: constr(min_length=1, max_length=50)
    description: Optional[constr(max_length=500)] = None
    latitude: confloat(ge=-90, le=90)
    longitude: confloat(ge=-180, le=180)
    is_active: bool = True


class FeedingPointResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    is_active: str
    created_at: datetime

    class Config:
        from_attributes = True


class FeedingCheckInCreate(BaseModel):
    food_remaining: Optional[str] = None
    cats_seen: int = 0
    note: Optional[str] = None


class FeedingCheckInResponse(BaseModel):
    id: int
    point_id: int
    user_id: int
    food_remaining: Optional[str]
    cats_seen: int
    note: Optional[str]
    created_at: datetime
    user_nickname: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    content: Optional[str]
    related_id: Optional[int]
    related_type: Optional[str]
    is_read: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    old_value: Optional[str]
    new_value: Optional[str]
    performed_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class FollowResponse(BaseModel):
    id: int
    cat_id: int
    cat_name: Optional[str] = None
    cat_avatar: Optional[str] = None
    created_at: datetime
    class Config: from_attributes = True


class FollowCreate(BaseModel):
    pass


class WechatLoginRequest(BaseModel):
    code: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class WechatLoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: UserProfile
    is_new: bool = False


class PaginatedCatsResponse(BaseModel):
    items: List[CatListResponse]
    total: int
    has_more: bool


class PaginatedSightingsResponse(BaseModel):
    items: List[SightingResponse]
    total: int
    has_more: bool


class PaginatedPostsResponse(BaseModel):
    items: List[PostResponse]
    total: int
    has_more: bool


class PaginatedHeatmapResponse(BaseModel):
    items: List[HeatmapPoint]
    total: int
    has_more: bool
