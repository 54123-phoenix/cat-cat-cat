from datetime import datetime
from typing import Optional, List, Literal
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


class GalleryImageResponse(CatImageResponse):
    cat: Optional[CatListResponse] = None


class SightingBase(BaseModel):
    cat_id: int
    location: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    note: Optional[str] = None
    spotted_by: Optional[str] = None
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
    status: Literal["confirmed", "uncertain", "unknown"]
    confidence: float
    cat_id: Optional[int] = None
    cat_name: Optional[str] = None
    candidates: List[RecognizeCandidate] = []


class UserProfile(BaseModel):
    id: int
    nickname: str
    avatar: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RelatedCatResponse(BaseModel):
    id: int
    name: str
    emoji: str = "cat"


class PostCreate(BaseModel):
    topic: Literal["find", "daily", "health", "suggest"]
    content: str
    tags: List[str] = []
    relatedCatId: Optional[int] = None
    image: Optional[str] = None


class PostResponse(BaseModel):
    id: int
    userId: str
    userEmoji: str = "user"
    topic: str
    content: str
    tags: List[str] = []
    relatedCat: Optional[RelatedCatResponse] = None
    image: Optional[str] = None
    likes: int
    liked: bool
    comments: int
    createdAt: str


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    postId: int
    userId: str
    userEmoji: str = "user"
    content: str
    createdAt: str


class HeatmapPoint(BaseModel):
    name: str
    latitude: float
    longitude: float
    count: int
