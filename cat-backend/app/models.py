import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from app.database import Base


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_key = Column(String(50), nullable=False)
    earned_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        UniqueConstraint("user_id", "badge_key", name="uq_user_badge"),
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    nickname = Column(String(50), nullable=False)
    role = Column(String(20), default="user")
    avatar = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)

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
    created_at = Column(DateTime, default=datetime.now)

    images = relationship("CatImage", back_populates="cat")
    sightings = relationship("Sighting", back_populates="cat")
    health_records = relationship("HealthRecord", back_populates="cat", cascade="all, delete-orphan", order_by="HealthRecord.record_date.desc()")


class CatImage(Base):
    __tablename__ = "cat_images"

    id = Column(Integer, primary_key=True, index=True)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False)
    image_path = Column(String(200), nullable=False)
    embedding_path = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)

    cat = relationship("Cat", back_populates="images")


class Sighting(Base):
    __tablename__ = "sightings"

    id = Column(Integer, primary_key=True, index=True)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False)
    image_path = Column(String(200))
    location = Column(String(100))
    location_name = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    confidence = Column(Float)
    activity_type = Column(String(20))
    note = Column(Text)
    spotted_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)

    cat = relationship("Cat", back_populates="sightings")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(20), nullable=False, default="daily")
    content = Column(Text, nullable=False)
    tags = Column(Text, default="[]")
    related_cat_id = Column(Integer, ForeignKey("cats.id"), nullable=True)
    status = Column(String(20), default="normal")
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    author = relationship("User", back_populates="posts")
    images = relationship("PostImage", back_populates="post", order_by="PostImage.sort_order")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    comment_list = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class PostImage(Base):
    __tablename__ = "post_images"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    image_path = Column(String(200), nullable=False)
    sort_order = Column(Integer, default=0)

    post = relationship("Post", back_populates="images")


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    post = relationship("Post", back_populates="likes")


class Comment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    post = relationship("Post", back_populates="comment_list")
    author = relationship("User", back_populates="comments")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(200), nullable=False)
    status = Column(String(20), default="pending")
    handled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)


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
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)

    cat = relationship("Cat", back_populates="health_records")


class FeedingPoint(Base):
    __tablename__ = "feeding_points"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_active = Column(String(10), nullable=False, default="yes")
    created_at = Column(DateTime, default=datetime.now)

    check_ins = relationship("FeedingCheckIn", back_populates="point", cascade="all, delete-orphan", order_by="FeedingCheckIn.created_at.desc()")


class FeedingCheckIn(Base):
    __tablename__ = "feeding_check_ins"

    id = Column(Integer, primary_key=True, index=True)
    point_id = Column(Integer, ForeignKey("feeding_points.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)
    food_remaining = Column(String(20))
    cats_seen = Column(Integer, default=0)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

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
    is_read = Column(String(10), nullable=False, default="no")
    created_at = Column(DateTime, default=datetime.now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(20), nullable=False, index=True)
    entity_type = Column(String(20), nullable=False)
    entity_id = Column(Integer)
    old_value = Column(Text)
    new_value = Column(Text)
    performed_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class UserCatFollow(Base):
    __tablename__ = "user_cat_follows"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cat_id = Column(Integer, ForeignKey("cats.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    __table_args__ = (UniqueConstraint("user_id", "cat_id", name="uq_user_cat_follow"),)
