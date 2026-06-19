import json
from datetime import datetime, timedelta

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, or_
from typing import Optional, List

from app import models, schemas


def _tags_to_json(tags: List[str]) -> str:
    return json.dumps(tags, ensure_ascii=False)


def _tags_from_json(value: str) -> List[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


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


def _serialize_post(post, current_user_id: int) -> schemas.PostResponse:
    liked = any(like.user_id == current_user_id for like in post.likes) if post.likes else False
    images = [img.image_path for img in (post.images or [])]
    related_cat = None
    if hasattr(post, 'related_cat') and post.related_cat:
        related_cat = schemas.RelatedCatResponse(id=post.related_cat.id, name=post.related_cat.name)
    user = schemas.UserBrief(id=post.author.id, nickname=post.author.nickname, avatar=post.author.avatar) if post.author else None
    return schemas.PostResponse(
        id=post.id,
        userId=post.user_id,
        user=user,
        topic=post.topic,
        content=post.content,
        tags=_tags_from_json(post.tags),
        images=images,
        relatedCat=related_cat,
        likes=post.likes_count or 0,
        liked=liked,
        comments=post.comments_count or 0,
        status=post.status,
        createdAt=_relative_time(post.created_at),
    )


def get_posts(db: Session, topic: str = "all", skip: int = 0, limit: int = 20, current_user_id: int = 0) -> List[schemas.PostResponse]:
    query = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
        joinedload(models.Post.comment_list),
    )
    if topic != "all":
        query = query.filter(models.Post.topic == topic)
    query = query.filter(models.Post.status.in_(["normal", "reported"]))
    posts = query.order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    return [_serialize_post(p, current_user_id) for p in posts]


def get_post(db: Session, post_id: int) -> Optional[models.Post]:
    return db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == post_id).first()


def create_post(db: Session, post: schemas.PostCreate, user_id: int, image_paths: List[str] = None) -> schemas.PostResponse:
    db_post = models.Post(
        user_id=user_id,
        topic=post.topic,
        content=post.content.strip(),
        tags=_tags_to_json(post.tags),
        related_cat_id=post.relatedCatId,
    )
    db.add(db_post)
    db.flush()
    if image_paths:
        for i, path in enumerate(image_paths):
            db.add(models.PostImage(post_id=db_post.id, image_path=path, sort_order=i))
    db.commit()
    db.refresh(db_post)
    post_with_rels = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == db_post.id).first()
    return _serialize_post(post_with_rels, user_id)


def update_post(db: Session, post_id: int, post_update: schemas.PostUpdate, user_id: int) -> Optional[schemas.PostResponse]:
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post or db_post.user_id != user_id:
        return None
    if post_update.content is not None:
        db_post.content = post_update.content.strip()
    if post_update.tags is not None:
        db_post.tags = _tags_to_json(post_update.tags)
    if post_update.relatedCatId is not None:
        db_post.related_cat_id = post_update.relatedCatId
    db.commit()
    db.refresh(db_post)
    post_with_rels = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == post_id).first()
    return _serialize_post(post_with_rels, user_id)


def delete_post(db: Session, post_id: int, user_id: int, is_admin: bool = False) -> bool:
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return False
    if not is_admin and db_post.user_id != user_id:
        return False
    db.delete(db_post)
    db.commit()
    return True


def toggle_post_like(db: Session, post_id: int, user_id: int) -> Optional[schemas.PostResponse]:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return None
    like = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == user_id,
    ).first()
    if like:
        db.delete(like)
        post.likes_count = max(0, (post.likes_count or 1) - 1)
    else:
        db.add(models.PostLike(post_id=post_id, user_id=user_id))
        post.likes_count = (post.likes_count or 0) + 1
    db.commit()
    post_with_rels = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == post_id).first()
    return _serialize_post(post_with_rels, user_id)


def get_comments(db: Session, post_id: int, skip: int = 0, limit: int = 50) -> List[schemas.CommentResponse]:
    comments = db.query(models.Comment).options(
        joinedload(models.Comment.author),
    ).filter(
        models.Comment.post_id == post_id
    ).order_by(models.Comment.created_at).offset(skip).limit(limit).all()
    return [
        schemas.CommentResponse(
            id=c.id,
            postId=c.post_id,
            userId=c.user_id,
            user=schemas.UserBrief(id=c.author.id, nickname=c.author.nickname, avatar=c.author.avatar) if c.author else None,
            content=c.content,
            createdAt=_relative_time(c.created_at),
        )
        for c in comments
    ]


def create_comment(db: Session, post_id: int, comment: schemas.CommentCreate, user_id: int) -> Optional[schemas.CommentResponse]:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return None
    db_comment = models.Comment(post_id=post_id, user_id=user_id, content=comment.content.strip())
    db.add(db_comment)
    post.comments_count = (post.comments_count or 0) + 1
    db.commit()
    db.refresh(db_comment)
    author = db.query(models.User).filter(models.User.id == user_id).first()
    return schemas.CommentResponse(
        id=db_comment.id,
        postId=db_comment.post_id,
        userId=db_comment.user_id,
        user=schemas.UserBrief(id=author.id, nickname=author.nickname, avatar=author.avatar) if author else None,
        content=db_comment.content,
        createdAt=_relative_time(db_comment.created_at),
    )


def report_post(db: Session, post_id: int, user_id: int, reason: str) -> bool:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return False
    existing = db.query(models.Report).filter(
        models.Report.post_id == post_id,
        models.Report.reported_by == user_id,
        models.Report.status == "pending",
    ).first()
    if existing:
        return False
    db.add(models.Report(post_id=post_id, reported_by=user_id, reason=reason))
    post.status = "reported"
    db.commit()
    return True


def get_reports(db: Session, status: str = "pending", skip: int = 0, limit: int = 50) -> List[schemas.ReportResponse]:
    query = db.query(models.Report).join(models.Post, models.Report.post_id == models.Post.id)
    if status:
        query = query.filter(models.Report.status == status)
    reports = query.order_by(desc(models.Report.created_at)).offset(skip).limit(limit).all()
    return [
        schemas.ReportResponse(
            id=r.id,
            postId=r.post_id,
            post_title=r.post.content[:50] if r.post else "",
            reported_by=r.reported_by,
            reason=r.reason,
            status=r.status,
            created_at=r.created_at,
        )
        for r in reports
    ]


def handle_report(db: Session, report_id: int, action: str, admin_id: int) -> bool:
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        return False
    if action == "dismiss":
        report.status = "dismissed"
        post = db.query(models.Post).filter(models.Post.id == report.post_id).first()
        if post and post.status == "reported":
            post.status = "normal"
    elif action == "hide":
        report.status = "resolved"
        post = db.query(models.Post).filter(models.Post.id == report.post_id).first()
        if post:
            post.status = "hidden"
    report.handled_by = admin_id
    db.commit()
    return True


def get_user(db: Session, user_id: int = 1) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


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


def get_sightings(db: Session, cat_id: Optional[int] = None, status: Optional[str] = None, skip: int = 0, limit: int = 20) -> List[models.Sighting]:
    query = db.query(models.Sighting)
    if cat_id:
        query = query.filter(models.Sighting.cat_id == cat_id)
    if status:
        query = query.filter(models.Sighting.status == status)
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


def create_sighting(db: Session, sighting: schemas.SightingCreate, image_path: Optional[str] = None, spotted_by: Optional[str] = None, status: str = "approved") -> models.Sighting:
    db_sighting = models.Sighting(**sighting.model_dump(), image_path=image_path, spotted_by=spotted_by, status=status)
    db.add(db_sighting)
    db.commit()
    db.refresh(db_sighting)
    return db_sighting


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


# ─── Badge Functions ─────────────────────────────────────────────────

def get_event_badges(db: Session, user_id: int) -> dict:
    rows = db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).all()
    return {r.badge_key: r.earned_at for r in rows}


def award_event_badge(db: Session, user_id: int, badge_key: str) -> bool:
    existing = db.query(models.UserBadge).filter(
        models.UserBadge.user_id == user_id,
        models.UserBadge.badge_key == badge_key,
    ).first()
    if existing:
        return False
    db.add(models.UserBadge(user_id=user_id, badge_key=badge_key))
    db.commit()
    return True


def get_user_stats_full(db: Session, user_id: int) -> dict:
    from app.config.badges import BADGE_CATALOG
    sightings = db.query(models.Sighting).count()
    posts = db.query(models.Post).filter(models.Post.user_id == user_id).count()
    cats_known = db.query(models.Cat).count()
    locations = db.query(models.Sighting.location).distinct().count()
    photos = db.query(models.CatImage).count()
    discoveries = 0
    approved = 0
    event_badges = get_event_badges(db, user_id)
    return {
        "sightings": sightings,
        "posts": posts,
        "cats_known": cats_known,
        "total_cats": cats_known,
        "locations_count": locations,
        "photos_count": photos,
        "discoveries": discoveries,
        "approved_discoveries": approved,
        "event_badges": event_badges,
    }


def compute_user_badges(db: Session, user_id: int) -> tuple:
    from app.config.badges import BADGE_CATALOG
    stats = get_user_stats_full(db, user_id)
    event_badges = stats.pop("event_badges")

    badge_details = []
    earned_keys = set()

    for badge_def in BADGE_CATALOG:
        bk = badge_def["badge_key"]
        btype = badge_def["type"]
        earned = False
        current = 0
        total = 1
        earned_at = None

        if btype == "auto":
            check_fn = badge_def.get("check_fn", "")
            current = 0
            total = 1

            # sighting badges
            if bk == "first_sighting":
                current = stats["sightings"]
                total = 1
                earned = current >= total
            elif bk == "cat_observer":
                current = stats["sightings"]
                total = 5
                earned = current >= total
            elif bk == "cat_expert":
                current = stats["sightings"]
                total = 20
                earned = current >= total
            # community badges
            elif bk == "first_post":
                current = stats["posts"]
                total = 1
                earned = current >= total
            elif bk == "community_helper":
                current = stats["posts"]
                total = 3
                earned = current >= total
            elif bk == "community_star":
                current = stats["posts"]
                total = 10
                earned = current >= total
            # collect badges
            elif bk == "cat_collector":
                current = stats["cats_known"]
                total = 5
                earned = current >= total
            elif bk == "cat_master":
                current = stats["cats_known"]
                total = stats["total_cats"]
                earned = current >= total and total > 0

            if earned:
                earned_keys.add(bk)

        elif btype == "event":
            earned = bk in event_badges
            earned_at = event_badges.get(bk)
            current = 1 if earned else 0
            total = 1
            if earned:
                earned_keys.add(bk)

        elif btype == "special":
            other_keys = {b["badge_key"] for b in BADGE_CATALOG if b["badge_key"] != bk}
            earned = other_keys.issubset(earned_keys)
            current = len(earned_keys)
            total = len(other_keys)

        badge_details.append({
            **badge_def,
            "earned": earned,
            "earned_at": earned_at,
            "progress_current": current,
            "progress_total": total,
        })

    badge_details.sort(key=lambda x: x["order"])
    return badge_details, stats, len(earned_keys)


# ─── Health Records ────────────────────────────────────────────────

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


# ─── Feeding Points ────────────────────────────────────────────────

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


# ─── Notifications ─────────────────────────────────────────────────

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


# ─── Audit Logs ────────────────────────────────────────────────────

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



# ─── Discovery ─────────────────────────────────────────────────

def create_discovery(db, image_path=None, location_name=None, latitude=None, longitude=None, note=None):
    from app import schemas
    now = datetime.now()
    discovery = models.Discovery(
        image_path=image_path,
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        note=note or "",
        status="pending",
        created_at=now,
    )
    db.add(discovery)
    db.commit()
    db.refresh(discovery)
    return schemas.DiscoveryResponse(
        id=discovery.id,
        image_path=discovery.image_path,
        location_name=discovery.location_name,
        latitude=discovery.latitude,
        longitude=discovery.longitude,
        note=discovery.note,
        status=discovery.status,
        created_at=discovery.created_at,
    )


def get_discoveries(db, status=None, skip=0, limit=50):
    from app import schemas
    query = db.query(models.Discovery)
    if status:
        query = query.filter(models.Discovery.status == status)
    discoveries = query.order_by(desc(models.Discovery.created_at)).offset(skip).limit(limit).all()
    return [
        schemas.DiscoveryResponse(
            id=d.id,
            image_path=d.image_path,
            location_name=d.location_name,
            latitude=d.latitude,
            longitude=d.longitude,
            note=d.note,
            status=d.status,
            created_at=d.created_at,
        )
        for d in discoveries
    ]


def review_discovery(db, discovery_id, review):
    from app import schemas
    discovery = db.query(models.Discovery).filter(models.Discovery.id == discovery_id).first()
    if not discovery:
        return None
    if review.action == "approve":
        discovery.status = "approved"
        if review.name:
            cat = db.query(models.Cat).filter(models.Cat.name == review.name).first()
            if not cat:
                cat = models.Cat(
                    name=review.name,
                    color=review.color or "待确认",
                    personality="校园猫猫，暂缺详细描述",
                    story="通过新发现线索创建",
                    location=discovery.location_name or "校园某处",
                )
                db.add(cat)
                db.flush()
            if discovery.image_path:
                db.add(models.CatImage(cat_id=cat.id, image_path=discovery.image_path))
    elif review.action == "reject":
        discovery.status = "rejected"
    else:
        raise ValueError(f"Invalid action: {review.action}")
    db.commit()
    db.refresh(discovery)
    return schemas.DiscoveryResponse(
        id=discovery.id,
        image_path=discovery.image_path,
        location_name=discovery.location_name,
        latitude=discovery.latitude,
        longitude=discovery.longitude,
        note=discovery.note,
        status=discovery.status,
        created_at=discovery.created_at,
    )


# ─── Weekly Report ─────────────────────────────────────────────────



def get_weekly_report(db: Session, user_id: int = 1):
    now = datetime.now()
    week_start = now - timedelta(days=7)

    week_sightings = db.query(models.Sighting).filter(
        models.Sighting.created_at >= week_start,
    ).all()

    user = db.query(models.User).filter(models.User.id == user_id).first()
    user_nickname = user.nickname if user else "猫猫爱好者"
    user_sightings = [s for s in week_sightings if s.spotted_by == user_nickname]

    unique_cats = len(set(s.cat_id for s in user_sightings))
    total_sightings = len(user_sightings)

    location_counts = {}
    for s in user_sightings:
        loc = s.location_name or s.location or "未知地点"
        location_counts[loc] = location_counts.get(loc, 0) + 1
    top_location = max(location_counts, key=location_counts.get) if location_counts else None
    top_location_count = location_counts.get(top_location, 0) if top_location else 0

    sighting_dates = sorted(set(s.created_at.date() for s in user_sightings))
    streak = 0
    if sighting_dates:
        streak = 1
        for i in range(len(sighting_dates) - 1, 0, -1):
            if (sighting_dates[i] - sighting_dates[i-1]).days == 1:
                streak += 1
            else:
                break

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


# ─── Post Search ───────────────────────────────────────────────────

def search_posts(db: Session, keyword: str, skip: int = 0, limit: int = 20, current_user_id: int = 0):
    from sqlalchemy import or_
    query = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(
        or_(
            models.Post.content.contains(keyword),
            models.Post.tags.contains(keyword),
        ),
        models.Post.status.in_(["normal", "reported"]),
    )
    posts = query.order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    return [_serialize_post(p, current_user_id) for p in posts]


def init_mock_data(db: Session):
    demo_cats = [
        {"name": "Amber", "color": "橘白", "personality": "亲人", "story": "", "location": "图书馆附近", "avatar": "/uploads/cats/Amber/avatar.jpg"},
        {"name": "Awu", "color": "黑白", "personality": "活泼", "story": "", "location": "树下", "avatar": "/uploads/cats/Awu/avatar.jpg"},
        {"name": "Baguette", "color": "橘色", "personality": "温和", "story": "", "location": "花园", "avatar": "/uploads/cats/Baguette/avatar.jpg"},
        {"name": "Chewy", "color": "狸花", "personality": "胆小", "story": "", "location": "", "avatar": "/uploads/cats/Chewy/avatar.jpg"},
        {"name": "Coco", "color": "三花", "personality": "粘人", "story": "", "location": "草坪", "avatar": "/uploads/cats/Coco/avatar.jpg"},
        {"name": "Curry", "color": "橘色", "personality": "慵懒", "story": "", "location": "长椅", "avatar": "/uploads/cats/Curry/avatar.jpg"},
        {"name": "DarkChocolate", "color": "深棕", "personality": "神秘", "story": "", "location": "", "avatar": "/uploads/cats/DarkChocolate/avatar.jpg"},
        {"name": "Glaze", "color": "白色", "personality": "优雅", "story": "", "location": "食堂附近", "avatar": "/uploads/cats/Glaze/avatar.jpg"},
        {"name": "LittleStick", "color": "条纹", "personality": "好奇", "story": "", "location": "", "avatar": "/uploads/cats/LittleStick/avatar.jpg"},
        {"name": "Meimei", "color": "三花", "personality": "温柔", "story": "", "location": "", "avatar": "/uploads/cats/Meimei/avatar.jpg"},
        {"name": "Nana", "color": "黑白", "personality": "亲人", "story": "", "location": "", "avatar": "/uploads/cats/Nana/avatar.jpg"},
        {"name": "Naonao", "color": "橘色", "personality": "调皮", "story": "", "location": "", "avatar": "/uploads/cats/Naonao/avatar.jpg"},
        {"name": "osmanthus", "color": "橘白", "personality": "安静", "story": "", "location": "桂花树下", "avatar": "/uploads/cats/osmanthus/avatar.jpg"},
        {"name": "PeanutCandy", "color": "狸花", "personality": "贪吃", "story": "", "location": "", "avatar": "/uploads/cats/PeanutCandy/avatar.jpg"},
        {"name": "Roll", "color": "橘色", "personality": "爱滚", "story": "", "location": "", "avatar": "/uploads/cats/Roll/avatar.jpg"},
        {"name": "Salmon", "color": "橘白", "personality": "好奇", "story": "", "location": "喷泉旁", "avatar": "/uploads/cats/Salmon/avatar.jpg"},
        {"name": "Shasha", "color": "狸花", "personality": "优雅", "story": "", "location": "喷泉旁", "avatar": "/uploads/cats/Shasha/avatar.jpg"},
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

    demo_user = db.query(models.User).filter(models.User.username == "demo").first()
    if not demo_user:
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        demo_user = models.User(
            username="demo",
            password_hash=pwd_ctx.hash("demo123"),
            nickname="Cat Lover",
            role="user",
            avatar="/uploads/avatar/default.jpg",
        )
        db.add(demo_user)
        db.flush()

    # Attach post images from uploaded files
    post_images = []
    posts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "posts")
    if os.path.isdir(posts_dir):
        post_images = sorted([
            f"/uploads/posts/{f}" for f in os.listdir(posts_dir)
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
        ])

    # Seed community posts
    if db.query(models.Post).count() == 0:
        seed_posts = [
            {
                "topic": "daily",
                "content": "今天在图书馆附近又看到 Amber 了！它正趴在台阶上晒太阳，眯着眼睛特别享受。路过的人都忍不住停下来摸两下 🐱",
                "cat_name": "Amber",
            },
            {
                "topic": "daily",
                "content": "Coco 今天在草坪上追蝴蝶，跑得飞快！拍了十几张照片才抓到一张清晰的。它好像又胖了一点 😅",
                "cat_name": "Coco",
            },
            {
                "topic": "find",
                "content": "请问有人最近在食堂附近看到 Glaze 吗？它白色的毛特别显眼，已经两天没见到它了，有点担心 🤔",
                "cat_name": "Glaze",
            },
            {
                "topic": "daily",
                "content": "Curry 还是老样子，躺在长椅上晒太阳。路过的同学说它已经在那睡了三个小时了 🛌 实名羡慕",
                "cat_name": "Curry",
            },
            {
                "topic": "health",
                "content": "Salmon 右前爪好像有点受伤，走路的时候不太敢着地。已经在联系猫协的同学了，希望没什么大问题 🙏",
                "cat_name": "Salmon",
            },
            {
                "topic": "suggest",
                "content": "建议在校园地图上标注一下每个喂食点的位置，方便大家去添粮。每次都要找半天才知道哪里可以喂 🗺️",
            },
            {
                "topic": "daily",
                "content": "Shasha 今天在喷泉旁边喝水，画面太治愈了！它真的是校园里最优雅的猫，走路都带着气质 ✨",
                "cat_name": "Shasha",
            },
            {
                "topic": "find",
                "content": "Baguette 好像找到新据点了——文科楼后面的小花园！今天看到它从那边的灌木丛里钻出来，估计以后那里也是常驻地了 🏠",
                "cat_name": "Baguette",
            },
            {
                "topic": "daily",
                "content": "今天带同学去看 Awu，结果它一路跟着我们走了小半个校园，最后还送我们到宿舍楼下。这猫是社牛吧 😂",
                "cat_name": "Awu",
            },
        ]
        for i, post_data in enumerate(seed_posts):
            cat_id = cat_ids.get(post_data.get("cat_name"))
            tags = [f"#{post_data['cat_name']}"] if post_data.get("cat_name") else []
            db_post = models.Post(
                user_id=demo_user.id,
                topic=post_data["topic"],
                content=post_data["content"],
                tags=json.dumps(tags, ensure_ascii=False),
                related_cat_id=cat_id,
                likes_count=0,
                comments_count=0,
            )
            db.add(db_post)
            db.flush()
            # Attach image to first few posts
            if i < len(post_images) and post_images[i]:
                db.add(models.PostImage(
                    post_id=db_post.id,
                    image_path=post_images[i],
                    sort_order=0,
                ))
        db.flush()

    db.commit()
