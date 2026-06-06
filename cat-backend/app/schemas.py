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


class RecognizeResponse(BaseModel):
    cat_id: int
    name: str
    confidence: float


class UserProfile(BaseModel):
    id: int
    nickname: str
    avatar: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
