from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


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


class CatCreate(CatBase):
    pass


class CatUpdate(CatBase):
    name: Optional[str] = None


class CatResponse(CatBase):
    id: int
    created_at: datetime
    images: List[CatImageResponse] = []
    health_records: List = []

    class Config:
        from_attributes = True


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
    confidence: Optional[float] = None


class SightingCreate(SightingBase):
    pass


class SightingResponse(SightingBase):
    id: int
    image_path: Optional[str]
    created_at: datetime
    cat: Optional[CatListResponse] = None

    class Config:
        from_attributes = True


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
    username: str
    password: str
    nickname: str


class UserLogin(BaseModel):
    username: str
    password: str


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
    content: str
    tags: List[str] = []
    relatedCatId: Optional[int] = None


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


class PostUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    relatedCatId: Optional[int] = None


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    postId: int
    userId: int
    user: Optional[UserBrief] = None
    content: str
    createdAt: str


class ReportCreate(BaseModel):
    reason: str


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
    action: str
    name: Optional[str] = None
    color: Optional[str] = None
    note: Optional[str] = None
    cat_id: Optional[int] = None


class HealthRecordCreate(BaseModel):
    record_type: str
    title: str
    description: Optional[str] = None
    record_date: datetime
    location: Optional[str] = None
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
    name: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    is_active: str = "yes"


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
