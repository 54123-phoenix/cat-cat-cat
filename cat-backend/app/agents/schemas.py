from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class CatIntelContext(BaseModel):
    location_name: Optional[str] = Field(default=None, max_length=100)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    client_time: Optional[datetime] = None


class CatIntelRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    context: CatIntelContext = Field(default_factory=CatIntelContext)


class CatIntelEvidence(BaseModel):
    label: str
    source: str
    observed_at: Optional[datetime] = None


class CatIntelAction(BaseModel):
    type: Literal["open_map", "open_cat", "start_route", "open_scan"]
    label: str
    params: dict[str, Any] = Field(default_factory=dict)


class CatIntelResponse(BaseModel):
    answer: str
    mode: Literal["fallback", "agent"] = "fallback"
    intent: str
    confidence: Literal["none", "low", "medium", "high"]
    evidence: list[CatIntelEvidence] = Field(default_factory=list)
    actions: list[CatIntelAction] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    generated_at: datetime
