import json
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List

from app import models, schemas
from app.services.ai import review_new_cat_discovery


def get_cats(db: Session, location: Optional[str] = None, skip: int = 0, limit: int = 20) -> List[models.Cat]:
    query = db.query(models.Cat)
    if location:
        query = query.filter(models.Cat.location == location)
    return query.order_by(desc(models.Cat.created_at)).offset(skip).limit(limit).all()


def get_cat(db: Session, cat_id: int) -> Optional[models.Cat]:
    return db.query(models.Cat).filter(models.Cat.id == cat_id).first()


def create_cat(db: Session, cat: schemas.CatCreate) -> models.Cat:
    db_cat = models.Cat(**cat.model_dump())
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat


def update_cat(db: Session, cat_id: int, cat: schemas.CatUpdate) -> Optional[models.Cat]:
    db_cat = db.query(models.Cat).filter(models.Cat.id == cat_id).first()
    if not db_cat:
        return None
    for key, value in cat.model_dump(exclude_unset=True).items():
        setattr(db_cat, key, value)
    db.commit()
    db.refresh(db_cat)
    return db_cat


def delete_cat(db: Session, cat_id: int) -> bool:
    db_cat = db.query(models.Cat).filter(models.Cat.id == cat_id).first()
    if not db_cat:
        return False
    db.delete(db_cat)
    db.commit()
    return True


def get_cat_images(db: Session, cat_id: int) -> List[models.CatImage]:
    return db.query(models.CatImage).filter(models.CatImage.cat_id == cat_id).order_by(desc(models.CatImage.created_at)).all()


def get_gallery_images(db: Session, skip: int = 0, limit: int = 60) -> List[models.CatImage]:
    return db.query(models.CatImage).order_by(desc(models.CatImage.created_at)).offset(skip).limit(limit).all()


def create_cat_image(db: Session, cat_id: int, image_path: str) -> models.CatImage:
    db_image = models.CatImage(cat_id=cat_id, image_path=image_path)
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image


def get_sightings(db: Session, cat_id: Optional[int] = None, skip: int = 0, limit: int = 20) -> List[models.Sighting]:
    query = db.query(models.Sighting)
    if cat_id:
        query = query.filter(models.Sighting.cat_id == cat_id)
    return query.order_by(desc(models.Sighting.created_at)).offset(skip).limit(limit).all()


def get_heatmap_points(db: Session, days: int = 7, limit: int = 100) -> List[schemas.HeatmapPoint]:
    query = db.query(
        models.Sighting.location_name,
        models.Sighting.location,
        models.Sighting.latitude,
        models.Sighting.longitude,
        func.count(models.Sighting.id).label("count"),
    ).filter(
        models.Sighting.latitude.isnot(None),
        models.Sighting.longitude.isnot(None),
    )

    if days > 0:
        query = query.filter(models.Sighting.created_at >= datetime.now() - timedelta(days=days))

    rows = query.group_by(
        models.Sighting.location_name,
        models.Sighting.location,
        models.Sighting.latitude,
        models.Sighting.longitude,
    ).order_by(desc("count")).limit(limit).all()

    return [
        schemas.HeatmapPoint(
            name=row.location_name or row.location or "校园某处",
            latitude=float(row.latitude),
            longitude=float(row.longitude),
            count=int(row.count),
        )
        for row in rows
    ]


def get_sighting(db: Session, sighting_id: int) -> Optional[models.Sighting]:
    return db.query(models.Sighting).filter(models.Sighting.id == sighting_id).first()


def create_sighting(db: Session, sighting: schemas.SightingCreate, image_path: Optional[str] = None) -> models.Sighting:
    db_sighting = models.Sighting(**sighting.model_dump(), image_path=image_path)
    db.add(db_sighting)
    db.commit()
    db.refresh(db_sighting)
    return db_sighting


def _relative_time(value: datetime) -> str:
    seconds = max(0, int((datetime.now() - value).total_seconds()))
    if seconds < 60:
        return "刚刚"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}分钟前"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}小时前"
    days = hours // 24
    return f"{days}天前"


def _parse_tags(value: Optional[str]) -> List[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def serialize_post(post: models.Post, current_user_id: int = 1) -> schemas.PostResponse:
    related_cat = None
    if post.related_cat:
        related_cat = schemas.RelatedCatResponse(id=post.related_cat.id, name=post.related_cat.name)
    return schemas.PostResponse(
        id=post.id,
        userId=str(post.user_id),
        topic=post.topic,
        content=post.content,
        tags=_parse_tags(post.tags),
        relatedCat=related_cat,
        image=post.image,
        likes=len(post.likes),
        liked=any(like.user_id == current_user_id for like in post.likes),
        comments=len(post.comments),
        createdAt=_relative_time(post.created_at),
    )


def get_posts(db: Session, topic: str = "all", skip: int = 0, limit: int = 20, current_user_id: int = 1) -> List[schemas.PostResponse]:
    query = db.query(models.Post)
    if topic != "all":
        query = query.filter(models.Post.topic == topic)
    posts = query.order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    return [serialize_post(post, current_user_id=current_user_id) for post in posts]


def search_posts(db: Session, keyword: str, skip: int = 0, limit: int = 20, current_user_id: int = 1) -> List[schemas.PostResponse]:
    from sqlalchemy import or_
    query = db.query(models.Post).filter(
        or_(
            models.Post.content.contains(keyword),
            models.Post.tags.contains(keyword),
        )
    )
    posts = query.order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    return [serialize_post(post, current_user_id=current_user_id) for post in posts]


def create_post(db: Session, post: schemas.PostCreate, current_user_id: int = 1) -> schemas.PostResponse:
    db_post = models.Post(
        user_id=current_user_id,
        topic=post.topic,
        content=post.content.strip(),
        tags=json.dumps(post.tags, ensure_ascii=False),
        related_cat_id=post.relatedCatId,
        image=post.image,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return serialize_post(db_post, current_user_id=current_user_id)


def toggle_post_like(db: Session, post_id: int, current_user_id: int = 1) -> Optional[schemas.PostResponse]:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return None
    like = db.query(models.PostLike).filter(models.PostLike.post_id == post_id, models.PostLike.user_id == current_user_id).first()
    if like:
        db.delete(like)
    else:
        db.add(models.PostLike(post_id=post_id, user_id=current_user_id))
    db.commit()
    db.refresh(post)
    return serialize_post(post, current_user_id=current_user_id)


def get_post_comments(db: Session, post_id: int, skip: int = 0, limit: int = 50) -> List[schemas.CommentResponse]:
    comments = db.query(models.PostComment).filter(models.PostComment.post_id == post_id).order_by(models.PostComment.created_at).offset(skip).limit(limit).all()
    return [
        schemas.CommentResponse(
            id=comment.id,
            postId=comment.post_id,
            userId=str(comment.user_id),
            content=comment.content,
            createdAt=_relative_time(comment.created_at),
        )
        for comment in comments
    ]


def create_comment(db: Session, post_id: int, comment: schemas.CommentCreate, current_user_id: int = 1) -> Optional[schemas.CommentResponse]:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return None
    db_comment = models.PostComment(post_id=post_id, user_id=current_user_id, content=comment.content.strip())
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return schemas.CommentResponse(
        id=db_comment.id,
        postId=db_comment.post_id,
        userId=str(db_comment.user_id),
        content=db_comment.content,
        createdAt=_relative_time(db_comment.created_at),
    )


def get_user(db: Session, user_id: int = 1) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_badges(db: Session, user_id: int = 1) -> List[str]:
    rows = db.query(models.BadgeEvent.badge_key).filter(models.BadgeEvent.user_id == user_id).all()
    badges = {row.badge_key for row in rows}
    stats = get_user_stats(db, user_id)
    if stats.sightings >= 1:
        badges.add("first_sighting")
    if stats.posts >= 1:
        badges.add("first_post")
    if stats.posts >= 3:
        badges.add("community_helper")
    if stats.sightings >= 5:
        badges.add("cat_observer")
    return sorted(badges)


def get_user_stats(db: Session, user_id: int = 1) -> schemas.UserStats:
    sightings = db.query(models.Sighting).filter(models.Sighting.spotted_by == "猫猫爱好者").count()
    posts = db.query(models.Post).filter(models.Post.user_id == user_id).count()
    discoveries = db.query(models.CatDiscovery).filter(models.CatDiscovery.user_id == user_id).count()
    approved_discoveries = db.query(models.CatDiscovery).filter(
        models.CatDiscovery.user_id == user_id,
        models.CatDiscovery.status == "approved",
    ).count()
    cats_known = db.query(models.Cat).count()
    return schemas.UserStats(
        sightings=sightings,
        posts=posts,
        discoveries=discoveries,
        approved_discoveries=approved_discoveries,
        cats_known=cats_known,
    )


def create_discovery(db: Session, image_path: Optional[str], location_name: Optional[str], latitude: Optional[float], longitude: Optional[float], note: Optional[str], user_id: int = 1) -> models.CatDiscovery:
    ai_review = review_new_cat_discovery(image_path=image_path, note=note)
    discovery = models.CatDiscovery(
        user_id=user_id,
        image_path=image_path,
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        note=note,
        ai_status=ai_review.ai_status,
        ai_confidence=ai_review.ai_confidence,
        ai_summary=ai_review.ai_summary,
        suggested_name=ai_review.suggested_name,
        suggested_color=ai_review.suggested_color,
    )
    db.add(discovery)
    db.commit()
    db.refresh(discovery)
    return discovery


def get_discoveries(db: Session, status: Optional[str] = None, skip: int = 0, limit: int = 50) -> List[models.CatDiscovery]:
    query = db.query(models.CatDiscovery)
    if status:
        query = query.filter(models.CatDiscovery.status == status)
    return query.order_by(desc(models.CatDiscovery.created_at)).offset(skip).limit(limit).all()


def review_discovery(db: Session, discovery_id: int, review: schemas.DiscoveryReview, reviewer: str = "cat_admin") -> Optional[models.CatDiscovery]:
    discovery = db.query(models.CatDiscovery).filter(models.CatDiscovery.id == discovery_id).first()
    if not discovery:
        return None
    if discovery.status != "pending":
        return discovery

    if review.action == "approve":
        cat = models.Cat(
            name=(review.name or discovery.suggested_name or "新朋友").strip(),
            color=review.color or discovery.suggested_color,
            location=discovery.location_name,
            story=review.note or discovery.note,
            avatar=discovery.image_path,
        )
        db.add(cat)
        db.flush()
        if discovery.image_path:
            db.add(models.CatImage(cat_id=cat.id, image_path=discovery.image_path))
        discovery.created_cat_id = cat.id
        discovery.status = "approved"
        db.add(models.BadgeEvent(user_id=discovery.user_id, badge_key="new_cat_finder", source_type="discovery", source_id=discovery.id))
    elif review.action == "merge":
        if not review.cat_id:
            raise ValueError("cat_id is required for merge")
        cat = db.query(models.Cat).filter(models.Cat.id == review.cat_id).first()
        if not cat:
            raise ValueError("target cat not found")
        discovery.created_cat_id = cat.id
        discovery.status = "merged"
    else:
        discovery.status = "rejected"

    discovery.reviewed_by = reviewer
    discovery.reviewed_at = datetime.now()
    db.commit()
    db.refresh(discovery)
    return discovery

def get_health_records(db: Session, cat_id: int, record_type: Optional[str] = None, limit: int = 50) -> List[models.HealthRecord]:
    query = db.query(models.HealthRecord).filter(models.HealthRecord.cat_id == cat_id)
    if record_type:
        query = query.filter(models.HealthRecord.record_type == record_type)
    return query.order_by(desc(models.HealthRecord.record_date)).limit(limit).all()


def create_health_record(db: Session, cat_id: int, record: schemas.HealthRecordCreate, created_by: int = 1) -> models.HealthRecord:
    db_record = models.HealthRecord(
        cat_id=cat_id,
        record_type=record.record_type,
        title=record.title,
        description=record.description,
        record_date=record.record_date,
        location=record.location,
        status=record.status,
        created_by=created_by,
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def delete_health_record(db: Session, record_id: int) -> bool:
    record = db.query(models.HealthRecord).filter(models.HealthRecord.id == record_id).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


def get_feeding_points(db: Session, active_only: bool = True) -> List[models.FeedingPoint]:
    query = db.query(models.FeedingPoint)
    if active_only:
        query = query.filter(models.FeedingPoint.is_active == "yes")
    return query.order_by(models.FeedingPoint.name).all()


def create_feeding_point(db: Session, point: schemas.FeedingPointCreate) -> models.FeedingPoint:
    db_point = models.FeedingPoint(**point.model_dump())
    db.add(db_point)
    db.commit()
    db.refresh(db_point)
    return db_point


def delete_feeding_point(db: Session, point_id: int) -> bool:
    point = db.query(models.FeedingPoint).filter(models.FeedingPoint.id == point_id).first()
    if not point:
        return False
    db.delete(point)
    db.commit()
    return True


def get_feeding_check_ins(db: Session, point_id: Optional[int] = None, limit: int = 50) -> List[models.FeedingCheckIn]:
    query = db.query(models.FeedingCheckIn)
    if point_id:
        query = query.filter(models.FeedingCheckIn.point_id == point_id)
    return query.order_by(desc(models.FeedingCheckIn.created_at)).limit(limit).all()


def create_feeding_check_in(db: Session, point_id: int, check_in: schemas.FeedingCheckInCreate, user_id: int = 1) -> models.FeedingCheckIn:
    db_check_in = models.FeedingCheckIn(
        point_id=point_id,
        user_id=user_id,
        food_remaining=check_in.food_remaining,
        cats_seen=check_in.cats_seen,
        note=check_in.note,
    )
    db.add(db_check_in)
    db.commit()
    db.refresh(db_check_in)
    return db_check_in


def create_notification(db: Session, user_id: int, notification_type: str, title: str, content: str = None, related_id: int = None, related_type: str = None) -> models.Notification:
    notification = models.Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        content=content,
        related_id=related_id,
        related_type=related_type,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def get_notifications(db: Session, user_id: int, unread_only: bool = False, limit: int = 50) -> List[models.Notification]:
    query = db.query(models.Notification).filter(models.Notification.user_id == user_id)
    if unread_only:
        query = query.filter(models.Notification.is_read == "no")
    return query.order_by(desc(models.Notification.created_at)).limit(limit).all()


def mark_notification_read(db: Session, notification_id: int, user_id: int) -> bool:
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user_id,
    ).first()
    if not notification:
        return False
    notification.is_read = "yes"
    db.commit()
    return True


def mark_all_notifications_read(db: Session, user_id: int) -> int:
    count = db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == "no",
    ).update({"is_read": "yes"})
    db.commit()
    return count


def create_audit_log(db: Session, action: str, entity_type: str, entity_id: int = None, old_value: str = None, new_value: str = None, performed_by: str = "admin") -> models.AuditLog:
    log = models.AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        performed_by=performed_by,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_audit_logs(db: Session, action: str = None, entity_type: str = None, limit: int = 100) -> List[models.AuditLog]:
    query = db.query(models.AuditLog)
    if action:
        query = query.filter(models.AuditLog.action == action)
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    return query.order_by(desc(models.AuditLog.created_at)).limit(limit).all()


def get_weekly_report(db: Session, user_id: int = 1):
    from datetime import timedelta
    now = datetime.now()
    week_start = now - timedelta(days=7)

    # This week's sightings by user
    week_sightings = db.query(models.Sighting).filter(
        models.Sighting.created_at >= week_start,
    ).all()

    # Filter by user nickname (since sightings don't have user_id yet)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    user_nickname = user.nickname if user else "猫猫爱好者"
    user_sightings = [s for s in week_sightings if s.spotted_by == user_nickname]

    unique_cats = len(set(s.cat_id for s in user_sightings))
    total_sightings = len(user_sightings)

    # Most frequent location
    location_counts = {}
    for s in user_sightings:
        loc = s.location_name or s.location or "未知地点"
        location_counts[loc] = location_counts.get(loc, 0) + 1
    top_location = max(location_counts, key=location_counts.get) if location_counts else None
    top_location_count = location_counts.get(top_location, 0) if top_location else 0

    # Daily streak (consecutive days with sightings)
    sighting_dates = sorted(set(s.created_at.date() for s in user_sightings))
    streak = 0
    if sighting_dates:
        streak = 1
        for i in range(len(sighting_dates) - 1, 0, -1):
            if (sighting_dates[i] - sighting_dates[i-1]).days == 1:
                streak += 1
            else:
                break

    # Last week's comparison
    last_week_start = week_start - timedelta(days=7)
    last_week_sightings = db.query(models.Sighting).filter(
        models.Sighting.created_at >= last_week_start,
        models.Sighting.created_at < week_start,
    ).all()
    last_week_user_sightings = [s for s in last_week_sightings if s.spotted_by == user_nickname]
    last_week_count = len(last_week_user_sightings)

    return {
        "week_start": week_start.isoformat(),
        "week_end": now.isoformat(),
        "total_sightings": total_sightings,
        "unique_cats": unique_cats,
        "top_location": top_location,
        "top_location_count": top_location_count,
        "streak_days": streak,
        "last_week_count": last_week_count,
        "trend": "up" if total_sightings > last_week_count else "down" if total_sightings < last_week_count else "same",
    }


def init_mock_data(db: Session):
    demo_cats = [
        {"name": "Amber", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Amber/avatar.jpg"},
        {"name": "Awu", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Awu/avatar.jpg"},
        {"name": "Baguette", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Baguette/avatar.jpg"},
        {"name": "Chewy", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Chewy/avatar.jpg"},
        {"name": "Coco", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Coco/avatar.jpg"},
        {"name": "Curry", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Curry/avatar.jpg"},
        {"name": "DarkChocolate", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/DarkChocolate/avatar.jpg"},
        {"name": "Glaze", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Glaze/avatar.jpg"},
        {"name": "LittleStick", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/LittleStick/avatar.jpg"},
        {"name": "Meimei", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Meimei/avatar.jpg"},
        {"name": "Nana", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Nana/avatar.jpg"},
        {"name": "Naonao", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Naonao/avatar.jpg"},
        {"name": "osmanthus", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/osmanthus/avatar.jpg"},
        {"name": "PeanutCandy", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/PeanutCandy/avatar.jpg"},
        {"name": "Roll", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Roll/avatar.jpg"},
        {"name": "Salmon", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Salmon/avatar.jpg"},
        {"name": "Shasha", "nickname": "", "gender": "", "neutered": "", "age_estimate": "", "color": "", "personality": "", "story": "", "location": "", "avatar": "/uploads/cats/Shasha/avatar.jpg"},
    ]

    cat_ids = {}
    for cat_data in demo_cats:
        cat = db.query(models.Cat).filter(models.Cat.name == cat_data["name"]).first()
        if not cat:
            cat = models.Cat(**cat_data)
            db.add(cat)
            db.flush()
        else:
            for key, value in cat_data.items():
                if getattr(cat, key, None) in (None, ""):
                    setattr(cat, key, value)
        cat_ids[cat_data["name"]] = cat.id

    db.commit()

    # Add reference images for each cat
    import os
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "cats")
    for cat_name, cat_id in cat_ids.items():
        if db.query(models.CatImage).filter(models.CatImage.cat_id == cat_id).count() == 0:
            cat_dir = os.path.join(uploads_dir, cat_name)
            if os.path.isdir(cat_dir):
                images = [f for f in os.listdir(cat_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
                for img in images:
                    db.add(models.CatImage(cat_id=cat_id, image_path=f"/uploads/cats/{cat_name}/{img}"))

    # Create sample sightings
    demo_sightings = [
        ("Amber", "Campus", 31.3009, 121.5037, "Spotted near the library", 0.95),
        ("Awu", "Campus", 31.2996, 121.5018, "Resting under a tree", 0.88),
        ("Baguette", "Campus", 31.3013, 121.5043, "Walking around the garden", 0.92),
        ("Coco", "Campus", 31.3001, 121.5005, "Playing with leaves", 0.86),
        ("Curry", "Campus", 31.3021, 121.5012, "Sleeping on a bench", 0.81),
        ("Glaze", "Campus", 31.2991, 121.5049, "Looking for food", 0.9),
        ("Salmon", "Campus", 31.3013, 121.5043, "Chasing butterflies", 0.84),
        ("Shasha", "Campus", 31.3013, 121.5043, "Sitting by the fountain", 0.79),
    ]

    for name, location, latitude, longitude, note, confidence in demo_sightings:
        cat_id = cat_ids[name]
        existing = db.query(models.Sighting).filter(
            models.Sighting.cat_id == cat_id,
            models.Sighting.note == note,
        ).first()
        if not existing:
            db.add(models.Sighting(cat_id=cat_id, location=location, location_name=location, latitude=latitude, longitude=longitude, spotted_by="Cat Lover", note=note, confidence=confidence))

    user = models.User(id=1, nickname="Cat Lover", avatar="/uploads/avatar/default.jpg")
    if not db.query(models.User).filter(models.User.id == 1).first():
        db.add(user)

    if db.query(models.Post).count() == 0:
        seed_posts = [
            ("daily", "Spotted Amber near the library today, looking healthy and happy!", ["#Amber", "#Campus", "#Cute"], "Amber"),
            ("find", "Has anyone seen Baguette recently? Last spotted near the garden.", ["#Baguette", "#Missing", "#Help"], "Baguette"),
            ("health", "Curry seems to have a slight limp. Already notified the campus cat care team.", ["#Curry", "#Health", "#Care"], "Curry"),
            ("suggest", "Would be great to have a 'last 24 hours' filter on the map for easier cat spotting.", ["#Suggestion", "#Map"], None),
        ]
        for topic, content, tags, cat_name in seed_posts:
            db.add(models.Post(
                user_id=1,
                topic=topic,
                content=content,
                tags=json.dumps(tags, ensure_ascii=False),
                related_cat_id=cat_ids.get(cat_name) if cat_name else None,
            ))

    db.commit()
