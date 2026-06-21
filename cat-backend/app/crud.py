import json
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, or_
from typing import Optional, List

from app import models, schemas
from app import events


def _tags_to_json(tags: List[str]) -> str:
    return json.dumps(tags, ensure_ascii=False)


def compute_level(xp: int) -> int:
    xp = xp or 0
    if xp < 0:
        xp = 0
    n = 1
    while xp >= 50 * n * (n - 1):
        n += 1
    return n - 1


def level_progress(xp: int) -> float:
    xp = xp or 0
    lvl = compute_level(xp)
    lower = 50 * lvl * (lvl - 1)
    upper = 50 * (lvl + 1) * lvl
    if upper <= lower:
        return 0.0
    return max(0.0, min(1.0, (xp - lower) / (upper - lower)))


def add_xp(db: Session, user, amount: int):
    if user is None or amount is None or amount == 0:
        return
    try:
        user.xp = (user.xp or 0) + amount
        user.level = compute_level(user.xp)
        db.commit()
    except Exception:
        db.rollback()


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


def _serialize_post(post, current_user_id: int, liked_ids: Optional[set] = None) -> schemas.PostResponse:
    if liked_ids is not None:
        liked = post.id in liked_ids
    else:
        liked = any(like.user_id == current_user_id for like in (post.likes or [])) if current_user_id else False
    images = [img.image_path for img in (post.images or [])]
    related_cat = None
    if hasattr(post, 'related_cat') and post.related_cat:
        related_cat = schemas.RelatedCatResponse(id=post.related_cat.id, name=post.related_cat.name)
    user = schemas.UserBrief(id=post.author.id, nickname=post.author.nickname, avatar=post.author.avatar) if post.author else None
    poll_options = _tags_from_json(post.poll_options) if post.poll_options else []
    try:
        poll_data = json.loads(post.poll_data) if post.poll_data else []
    except (json.JSONDecodeError, TypeError):
        poll_data = []
    if not poll_data and poll_options:
        poll_data = [0] * len(poll_options)
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
        postType=getattr(post, 'post_type', 'discussion') or 'discussion',
        pollOptions=poll_options,
        pollData=poll_data,
        acceptedCommentId=getattr(post, 'accepted_comment_id', None),
    )


def count_posts(db: Session, topic: str = "all", keyword: Optional[str] = None) -> int:
    query = db.query(func.count(models.Post.id)).filter(models.Post.status == "normal")
    if keyword and keyword.strip():
        query = query.filter(
            or_(
                models.Post.content.contains(keyword.strip()),
                models.Post.tags.contains(keyword.strip()),
            )
        )
    elif topic != "all":
        query = query.filter(models.Post.topic == topic)
    return query.scalar() or 0


def get_posts(db: Session, topic: str = "all", skip: int = 0, limit: int = 20, current_user_id: int = 0) -> List[schemas.PostResponse]:
    query = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.comment_list),
    )
    if topic != "all":
        query = query.filter(models.Post.topic == topic)
    query = query.filter(models.Post.status == "normal")
    posts = query.order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    liked_ids = set()
    if current_user_id and posts:
        post_ids = [p.id for p in posts]
        liked_ids = {
            pl.post_id
            for pl in db.query(models.PostLike).filter(
                models.PostLike.user_id == current_user_id,
                models.PostLike.post_id.in_(post_ids),
            ).all()
        }
    return [_serialize_post(p, current_user_id, liked_ids) for p in posts]


def get_post(db: Session, post_id: int) -> Optional[models.Post]:
    return db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == post_id).first()


def create_post(db: Session, post: schemas.PostCreate, user_id: int, image_paths: List[str] = None) -> schemas.PostResponse:
    post_type = (post.postType or "discussion").strip()
    poll_options_json = None
    poll_data_json = None
    if post_type == "poll":
        options = [o.strip() for o in (post.pollOptions or []) if o.strip()]
        if len(options) < 2:
            raise ValueError("投票帖至少需要 2 个选项")
        poll_options_json = json.dumps(options, ensure_ascii=False)
        poll_data_json = json.dumps([0] * len(options))
    db_post = models.Post(
        user_id=user_id,
        topic=post.topic,
        content=post.content.strip(),
        tags=_tags_to_json(post.tags),
        related_cat_id=post.relatedCatId,
        post_type=post_type,
        poll_options=poll_options_json,
        poll_data=poll_data_json,
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
    author = post_with_rels.author if post_with_rels else None
    if author is not None:
        add_xp(db, author, 5)
    events.publish("post_new", {
        "post_id": db_post.id,
        "user_id": user_id,
        "topic": db_post.topic,
    })
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
        events.publish("like_new", {"post_id": post_id, "user_id": user_id})
    db.commit()
    post_with_rels = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == post_id).first()
    return _serialize_post(post_with_rels, user_id)


def get_comments(db: Session, post_id: int, skip: int = 0, limit: int = 50) -> List[schemas.CommentResponse]:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    accepted_id = getattr(post, "accepted_comment_id", None) if post else None
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
            accepted=(c.id == accepted_id),
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
    if author is not None:
        add_xp(db, author, 2)
    events.publish("comment_new", {
        "post_id": post_id,
        "comment_id": db_comment.id,
        "user_id": user_id,
        "user_nickname": author.nickname if author else None,
    })
    accepted_id = getattr(post, "accepted_comment_id", None)
    return schemas.CommentResponse(
        id=db_comment.id,
        postId=db_comment.post_id,
        userId=db_comment.user_id,
        user=schemas.UserBrief(id=author.id, nickname=author.nickname, avatar=author.avatar) if author else None,
        content=db_comment.content,
        createdAt=_relative_time(db_comment.created_at),
        accepted=(db_comment.id == accepted_id),
    )


def poll_vote(db: Session, post_id: int, user_id: int, option_index: int) -> Optional[schemas.PostResponse]:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post or (post.post_type or "discussion") != "poll":
        return None
    options = _tags_from_json(post.poll_options) if post.poll_options else []
    if option_index < 0 or option_index >= len(options):
        return None
    existing = db.query(models.PostPollVote).filter(
        models.PostPollVote.post_id == post_id,
        models.PostPollVote.user_id == user_id,
    ).first()
    if existing:
        existing.option_index = option_index
    else:
        db.add(models.PostPollVote(post_id=post_id, user_id=user_id, option_index=option_index))
    db.flush()
    rows = db.query(
        models.PostPollVote.option_index,
        func.count(models.PostPollVote.id),
    ).filter(models.PostPollVote.post_id == post_id).group_by(models.PostPollVote.option_index).all()
    counts = {idx: cnt for idx, cnt in rows}
    poll_data = [counts.get(i, 0) for i in range(len(options))]
    post.poll_data = json.dumps(poll_data)
    db.commit()
    events.publish("poll_voted", {"post_id": post_id, "user_id": user_id, "option_index": option_index})
    post_with_rels = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == post_id).first()
    return _serialize_post(post_with_rels, user_id)


def accept_answer(db: Session, post_id: int, comment_id: int, user_id: int, is_admin: bool = False) -> Optional[schemas.PostResponse]:
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return None
    if not is_admin and post.user_id != user_id:
        return None
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id,
    ).first()
    if not comment:
        return None
    post.accepted_comment_id = comment_id
    db.commit()
    events.publish("answer_accepted", {"post_id": post_id, "comment_id": comment_id})
    post_with_rels = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.images),
        joinedload(models.Post.likes),
    ).filter(models.Post.id == post_id).first()
    return _serialize_post(post_with_rels, user_id)


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


def count_cats(db: Session, location: Optional[str] = None) -> int:
    query = db.query(func.count(models.Cat.id))
    if location:
        query = query.filter(models.Cat.location == location)
    return query.scalar() or 0


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


def count_sightings(db: Session, cat_id: Optional[int] = None, status: Optional[str] = None) -> int:
    query = db.query(func.count(models.Sighting.id))
    if cat_id:
        query = query.filter(models.Sighting.cat_id == cat_id)
    if status:
        query = query.filter(models.Sighting.status == status)
    return query.scalar() or 0


def get_sightings(db: Session, cat_id: Optional[int] = None, status: Optional[str] = None, skip: int = 0, limit: int = 20) -> List[models.Sighting]:
    query = db.query(models.Sighting)
    if cat_id:
        query = query.filter(models.Sighting.cat_id == cat_id)
    if status:
        query = query.filter(models.Sighting.status == status)
    return query.order_by(desc(models.Sighting.created_at)).offset(skip).limit(limit).all()


def count_heatmap_points(db: Session, days: int = 7) -> int:
    query = db.query(func.count()).filter(
        models.Sighting.latitude.isnot(None),
        models.Sighting.longitude.isnot(None),
    )
    if days > 0:
        query = query.filter(models.Sighting.created_at >= datetime.now() - timedelta(days=days))
    subq = db.query(
        models.Sighting.location_name,
        models.Sighting.location,
        models.Sighting.latitude,
        models.Sighting.longitude,
    ).filter(
        models.Sighting.latitude.isnot(None),
        models.Sighting.longitude.isnot(None),
    )
    if days > 0:
        subq = subq.filter(models.Sighting.created_at >= datetime.now() - timedelta(days=days))
    return db.query(func.count()).select_from(subq.group_by(
        models.Sighting.location_name,
        models.Sighting.location,
        models.Sighting.latitude,
        models.Sighting.longitude,
    ).subquery()).scalar() or 0


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


def get_nearby_sightings(db: Session, lat: float, lng: float, radius_km: float):
    import math
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
    lat_min = lat - lat_delta
    lat_max = lat + lat_delta
    lng_min = lng - lng_delta
    lng_max = lng + lng_delta

    rows = (
        db.query(
            models.Sighting.cat_id,
            models.Sighting.latitude,
            models.Sighting.longitude,
            models.Sighting.created_at,
            models.Cat.name,
            models.Cat.avatar,
        )
        .join(models.Cat, models.Sighting.cat_id == models.Cat.id)
        .filter(
            models.Sighting.latitude.isnot(None),
            models.Sighting.longitude.isnot(None),
            models.Sighting.latitude.between(lat_min, lat_max),
            models.Sighting.longitude.between(lng_min, lng_max),
        )
        .all()
    )
    return rows


def get_sighting(db: Session, sighting_id: int) -> Optional[models.Sighting]:
    return db.query(models.Sighting).filter(models.Sighting.id == sighting_id).first()


def create_sighting(db: Session, sighting: schemas.SightingCreate, image_path: Optional[str] = None, spotted_by: Optional[str] = None, user_id: Optional[int] = None, status: str = "approved") -> models.Sighting:
    db_sighting = models.Sighting(**sighting.model_dump(), image_path=image_path, spotted_by=spotted_by, user_id=user_id, status=status)
    db.add(db_sighting)
    db.commit()
    db.refresh(db_sighting)
    if user_id is not None:
        _u = db.query(models.User).filter(models.User.id == user_id).first()
        if _u is not None:
            add_xp(db, _u, 10)
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
    events.publish("badge_unlock", {"user_id": user_id, "badge_key": badge_key})
    return True


def get_user_stats_full(db: Session, user_id: int) -> dict:
    from app.config.badges import BADGE_CATALOG
    sightings = db.query(models.Sighting).filter(models.Sighting.user_id == user_id).count()
    posts = db.query(models.Post).filter(models.Post.user_id == user_id).count()
    cats_known = db.query(models.UserCatFollow).filter(models.UserCatFollow.user_id == user_id).count()
    locations = db.query(models.Sighting.location).filter(models.Sighting.user_id == user_id).distinct().count()
    photos = db.query(models.Sighting).filter(
        models.Sighting.user_id == user_id,
        models.Sighting.image_path.isnot(None),
    ).count()
    discoveries = db.query(models.Discovery).filter(models.Discovery.status == "pending").count() if hasattr(models, 'Discovery') else 0
    approved = db.query(models.Discovery).filter(models.Discovery.status == "approved").count() if hasattr(models, 'Discovery') else 0
    event_badges = get_event_badges(db, user_id)

    user = db.query(models.User).filter(models.User.id == user_id).first()
    xp = (user.xp or 0) if user else 0
    level = compute_level(xp)
    progress = level_progress(xp)

    sighting_dates = sorted({
        s.created_at.date()
        for s in db.query(models.Sighting.created_at).filter(models.Sighting.user_id == user_id).all()
        if s.created_at is not None
    })
    streak = 0
    if sighting_dates:
        today = datetime.now().date()
        if sighting_dates[-1] == today:
            streak = 1
            for i in range(len(sighting_dates) - 1, 0, -1):
                if (sighting_dates[i] - sighting_dates[i - 1]).days == 1:
                    streak += 1
                else:
                    break
        else:
            streak = 0
    longest = streak
    if user is not None:
        try:
            longest = max((user.longest_streak or 0), streak)
            if (user.longest_streak or 0) < longest:
                user.longest_streak = longest
        except Exception:
            pass
    db.commit()


def get_campuses(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Campus).offset(skip).limit(limit).all()

def get_campus(db: Session, campus_id: int):
    return db.query(models.Campus).filter(models.Campus.id == campus_id).first()

def get_campus_by_slug(db: Session, slug: str):
    return db.query(models.Campus).filter(models.Campus.slug == slug).first()

def create_campus(db: Session, campus: schemas.CampusCreate):
    db_campus = models.Campus(**campus.model_dump())
    db.add(db_campus)
    db.commit()
    db.refresh(db_campus)
    return db_campus


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
        query = query.filter(models.FeedingPoint.is_active == True)
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
        query = query.filter(models.Notification.is_read == False)
    return query.order_by(desc(models.Notification.created_at)).limit(limit).all()


def mark_notification_read(db: Session, notification_id: int, user_id: int) -> bool:
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user_id,
    ).first()
    if not notification:
        return False
    notification.is_read = True
    db.commit()
    return True


def mark_all_notifications_read(db: Session, user_id: int) -> int:
    count = db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False,
    ).update({"is_read": True})
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
    events.publish("discovery_reviewed", {
        "discovery_id": discovery.id,
        "status": discovery.status,
    })
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
        models.Sighting.user_id == user_id,
    ).all()

    user = db.query(models.User).filter(models.User.id == user_id).first()
    user_sightings = week_sightings

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
        models.Sighting.user_id == user_id,
    ).all()
    last_week_user_sightings = last_week_sightings
    last_week_count = len(last_week_user_sightings)

    cat_counts_this_week = {}
    for s in user_sightings:
        if s.cat_id is not None:
            cat_counts_this_week[s.cat_id] = cat_counts_this_week.get(s.cat_id, 0) + 1
    benming_cat_this_week = None
    if cat_counts_this_week:
        benming_cat_id = max(cat_counts_this_week, key=cat_counts_this_week.get)
        benming_cat_obj = db.query(models.Cat).filter(models.Cat.id == benming_cat_id).first()
        if benming_cat_obj:
            benming_cat_this_week = {
                "id": benming_cat_obj.id,
                "name": benming_cat_obj.name,
                "avatar": benming_cat_obj.avatar,
                "count": cat_counts_this_week[benming_cat_id],
            }

    league_rank = None
    from app.models import User as _User
    all_users = db.query(_User).order_by(_User.xp.desc()).all()
    for idx, u in enumerate(all_users):
        if u.id == user_id:
            league_rank = idx + 1
            break

    return {
        "week_start": week_start.isoformat(),
        "week_end": now.isoformat(),
        "total_sightings": total_sightings,
        "unique_cats": unique_cats,
        "top_location": top_location,
        "top_location_count": top_location_count,
        "streak_days": streak,
        "streak": streak,
        "last_week_count": last_week_count,
        "last_week_sightings": last_week_count,
        "trend": "up" if total_sightings > last_week_count else "down" if total_sightings < last_week_count else "same",
        "league_rank": league_rank,
        "benming_cat_this_week": benming_cat_this_week,
    }


def get_wrapped_report(db: Session, user_id: int):
    now = datetime.now()
    year = now.year
    year_start = datetime(year, 1, 1)

    sightings = db.query(models.Sighting).filter(
        models.Sighting.user_id == user_id,
        models.Sighting.created_at >= year_start,
    ).all()

    total_sightings = len(sightings)
    distinct_cats = len({s.cat_id for s in sightings if s.cat_id is not None})

    location_counts = {}
    for s in sightings:
        loc = s.location_name or s.location or "未知地点"
        location_counts[loc] = location_counts.get(loc, 0) + 1
    top_locations = [
        {"name": name, "count": cnt}
        for name, cnt in sorted(location_counts.items(), key=lambda x: x[1], reverse=True)
    ][:5]

    cat_counts = {}
    for s in sightings:
        if s.cat_id is not None:
            cat_counts[s.cat_id] = cat_counts.get(s.cat_id, 0) + 1
    benming_cat = None
    if cat_counts:
        benming_cat_id = max(cat_counts, key=cat_counts.get)
        cat_obj = db.query(models.Cat).filter(models.Cat.id == benming_cat_id).first()
        if cat_obj:
            benming_cat = {
                "id": cat_obj.id,
                "name": cat_obj.name,
                "avatar": cat_obj.avatar,
                "count": cat_counts[benming_cat_id],
            }

    badge_details, _, badge_count = compute_user_badges(db, user_id)
    badges_earned = [b["badge_key"] for b in badge_details if b.get("earned")]

    stats = get_user_stats_full(db, user_id)
    total_xp = stats["xp"]
    level = stats["level"]
    streak = stats["streak"]
    longest_streak = stats["longest_streak"]

    collection_count = db.query(models.UserCatFollow).filter(
        models.UserCatFollow.user_id == user_id
    ).count()
    collection_total = db.query(models.Cat).count()

    return {
        "year": year,
        "total_sightings": total_sightings,
        "distinct_cats": distinct_cats,
        "top_locations": top_locations,
        "badges_earned": badges_earned,
        "benming_cat": benming_cat,
        "total_xp": total_xp,
        "level": level,
        "collection_count": collection_count,
        "collection_total": collection_total,
        "streak": streak,
        "longest_streak": longest_streak,
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
        models.Post.status == "normal",
    )
    posts = query.order_by(desc(models.Post.created_at)).offset(skip).limit(limit).all()
    return [_serialize_post(p, current_user_id) for p in posts]


import secrets

def create_invite_code(db: Session, user_id: int) -> models.InviteCode:
    code = secrets.token_urlsafe(8)[:12].upper()
    while db.query(models.InviteCode).filter(models.InviteCode.code == code).first():
        code = secrets.token_urlsafe(8)[:12].upper()
    invite = models.InviteCode(code=code, created_by=user_id)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite

def use_invite_code(db: Session, code: str, user_id: int) -> Optional[models.InviteCode]:
    invite = db.query(models.InviteCode).filter(models.InviteCode.code == code, models.InviteCode.used_by == None).first()
    if not invite:
        return None
    invite.used_by = user_id
    invite.used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invite)
    return invite

def get_user_invite_codes(db: Session, user_id: int) -> List:
    return db.query(models.InviteCode).filter(models.InviteCode.created_by == user_id).order_by(models.InviteCode.created_at.desc()).all()


def init_mock_data(db: Session):
    if os.getenv("INIT_DEMO_USER") != "1":
        return

    cat_ids = {}
    real_cats = db.query(models.Cat).all()
    for cat in real_cats:
        cat_ids[cat.name] = cat.id

    db.commit()

    # Create demo user if not exists
    demo_user = db.query(models.User).filter(models.User.username == "demo").first()
    if not demo_user:
        from passlib.context import CryptContext
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        demo_user = models.User(
            username="demo",
            password_hash=pwd_ctx.hash(os.environ["DEMO_PASSWORD"]),
            nickname="Cat Lover",
            role="user",
        )
        db.add(demo_user)
        db.flush()

    db.commit()
