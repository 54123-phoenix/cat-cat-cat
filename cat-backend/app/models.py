from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


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
    location = Column(String(100))
    avatar = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)

    images = relationship("CatImage", back_populates="cat")
    sightings = relationship("Sighting", back_populates="cat")


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
    note = Column(Text)
    spotted_by = Column(String(50))
    confidence = Column(Float)
    created_at = Column(DateTime, default=datetime.now)

    cat = relationship("Cat", back_populates="sightings")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nickname = Column(String(50), nullable=False)
    avatar = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)
    topic = Column(String(20), nullable=False, index=True)
    content = Column(Text, nullable=False)
    tags = Column(Text)
    related_cat_id = Column(Integer, ForeignKey("cats.id"))
    image = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User")
    related_cat = relationship("Cat")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    post = relationship("Post", back_populates="comments")
    user = relationship("User")


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_like_user"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.now)

    post = relationship("Post", back_populates="likes")
    user = relationship("User")


class CatDiscovery(Base):
    __tablename__ = "cat_discoveries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)
    image_path = Column(String(200))
    location_name = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    note = Column(Text)
    ai_status = Column(String(30), default="needs_review")
    ai_confidence = Column(Float)
    ai_summary = Column(Text)
    suggested_name = Column(String(50))
    suggested_color = Column(String(50))
    status = Column(String(20), nullable=False, default="pending")
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime)
    created_cat_id = Column(Integer, ForeignKey("cats.id"))
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User")
    created_cat = relationship("Cat")


class BadgeEvent(Base):
    __tablename__ = "badge_events"
    __table_args__ = (UniqueConstraint("user_id", "badge_key", "source_type", "source_id", name="uq_badge_source"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, default=1)
    badge_key = Column(String(50), nullable=False)
    source_type = Column(String(50))
    source_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User")
