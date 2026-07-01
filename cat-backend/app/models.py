import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from app.database import Base


class Discovery(Base):
    __tablename__ = "discoveries"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String(200))
    location_name = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    note = Column(Text)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_key = Column(String(50), nullable=False)
    earned_at = Column(DateTime, default=datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("user_id", "badge_key", name="uq_user_badge"),)


class Campus(Base):
    __tablename__ = "campuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    bounds_ne_lat = Column(Float)
    bounds_ne_lng = Column(Float)
    bounds_sw_lat = Column(Float)
    bounds_sw_lng = Column(Float)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    nickname = Column(String(50), nullable=False)
    role = Column(String(20), default="user")
    avatar = Column(String(200))
    openid = Column(String(100), unique=True, nullable=True, index=True)
    session_key = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    longest_streak = Column(Integer, default=0)
    token_version = Column(Integer, default=1)
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True, index=True)

    posts = relationship("Post", back_populates="author")
    comments = relationship("Comment", back_populates="author")


class Cat(Base):
    __tablename__ = "cats"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    nickname = Column(String(100))
    gender = Column(String(10))
    neutered = Column(String(10))
    age_estimate = Column(String(20))
    color = Column(String(50))
    personality = Column(Text)
    story = Column(Text)
    location = Column(String(100), index=True)
    avatar = Column(String(200))
    personality_radar = Column(Text)
    quote = Column(String(120))
    aliases = Column(String(120))
    relationships = Column(Text)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True, index=True)

    images = relationship("CatImage", back_populates="cat")
    sightings = relationship("Sighting", back_populates="cat")
    health_records = relationship(
        "HealthRecord",
        back_populates="cat",
        cascade="all, delete-orphan",
        order_by="HealthRecord.record_date.desc()",
    )


class CatImage(Base):
    __tablename__ = "cat_images"

    id = Column(Integer, primary_key=True, index=True)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False, index=True)
    image_path = Column(String(200), nullable=False)
    embedding_path = Column(String(200))
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    cat = relationship("Cat", back_populates="images")


class Sighting(Base):
    __tablename__ = "sightings"

    id = Column(Integer, primary_key=True, index=True)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    image_path = Column(String(200))
    location = Column(String(100))
    location_name = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    confidence = Column(Float)
    activity_type = Column(String(20))
    note = Column(Text)
    status = Column(String(20), default="approved")
    spotted_by = Column(String(50))
    confirmations = Column(Integer, default=0)
    grade = Column(String(20), default="casual")
    weather = Column(String(20))
    mood = Column(String(20))
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    cat = relationship("Cat", back_populates="sightings")
    user = relationship("User")


class SightingConfirmation(Base):
    __tablename__ = "sighting_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    sighting_id = Column(
        Integer, ForeignKey("sightings.id"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("sighting_id", "user_id", name="uq_sighting_confirmation"),
    )


class SightingVote(Base):
    __tablename__ = "sighting_votes"

    id = Column(Integer, primary_key=True, index=True)
    sighting_id = Column(
        Integer, ForeignKey("sightings.id"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("sighting_id", "user_id", name="uq_sighting_vote"),
    )


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic = Column(String(20), nullable=False, default="daily")
    content = Column(Text, nullable=False)
    tags = Column(Text, default="[]")
    related_cat_id = Column(Integer, ForeignKey("cats.id"), nullable=True)
    status = Column(String(20), default="normal")
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    post_type = Column(String(20), default="discussion")
    poll_options = Column(Text)
    poll_data = Column(Text)
    accepted_comment_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=datetime.now(timezone.utc),
        onupdate=datetime.now(timezone.utc),
    )

    author = relationship("User", back_populates="posts")
    images = relationship(
        "PostImage", back_populates="post", order_by="PostImage.sort_order"
    )
    likes = relationship(
        "PostLike", back_populates="post", cascade="all, delete-orphan"
    )
    comment_list = relationship(
        "Comment", back_populates="post", cascade="all, delete-orphan"
    )


class PostImage(Base):
    __tablename__ = "post_images"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    image_path = Column(String(200), nullable=False)
    sort_order = Column(Integer, default=0)

    post = relationship("Post", back_populates="images")


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    post = relationship("Post", back_populates="likes")


class PostPollVote(Base):
    __tablename__ = "post_poll_votes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    option_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_poll_vote"),)


class Comment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    post = relationship("Post", back_populates="comment_list")
    author = relationship("User", back_populates="comments")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(200), nullable=False)
    status = Column(String(20), default="pending")
    handled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    post = relationship("Post")


class HealthRecord(Base):
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, index=True)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False, index=True)
    record_type = Column(String(20), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text)
    record_date = Column(DateTime, nullable=False)
    location = Column(String(100))
    status = Column(String(20), nullable=False, default="completed")
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)

    cat = relationship("Cat", back_populates="health_records")


class FeedingPoint(Base):
    __tablename__ = "feeding_points"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True, index=True)

    check_ins = relationship(
        "FeedingCheckIn",
        back_populates="point",
        cascade="all, delete-orphan",
        order_by="FeedingCheckIn.created_at.desc()",
    )


class FeedingCheckIn(Base):
    __tablename__ = "feeding_check_ins"

    id = Column(Integer, primary_key=True, index=True)
    point_id = Column(
        Integer, ForeignKey("feeding_points.id"), nullable=False, index=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, default=1, index=True
    )
    food_remaining = Column(String(20))
    cats_seen = Column(Integer, default=0)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    point = relationship("FeedingPoint", back_populates="check_ins")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    content = Column(Text)
    related_id = Column(Integer)
    related_type = Column(String(20))
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(20), nullable=False, index=True)
    entity_type = Column(String(20), nullable=False)
    entity_id = Column(Integer)
    old_value = Column(Text)
    new_value = Column(Text)
    performed_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


class UserCatFollow(Base):
    __tablename__ = "user_cat_follows"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "cat_id", name="uq_user_cat_follow"),)


class UserCollectible(Base):
    __tablename__ = "user_collectibles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    collectible_type = Column(String(30), nullable=False)
    key = Column(String(100), nullable=False)
    display_name = Column(String(100), nullable=False)
    emoji = Column(String(10))
    extra_data = Column(Text)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint(
            "user_id", "collectible_type", "key", name="uq_user_collectible"
        ),
    )


class RouteCheckin(Base):
    __tablename__ = "route_checkins"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    time_slot = Column(String(20), nullable=False)
    stop_name = Column(String(100), nullable=False)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint("user_id", "time_slot", "stop_name", name="uq_route_checkin"),
    )


class DailyCapsuleClaim(Base):
    __tablename__ = "daily_capsule_claims"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    claim_date = Column(String(10), nullable=False)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=True)
    sticker = Column(String(10))
    title = Column(String(50))
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint("user_id", "claim_date", name="uq_daily_capsule_claim"),
    )
