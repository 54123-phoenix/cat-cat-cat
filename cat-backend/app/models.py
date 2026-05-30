from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
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
