import json
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List

from app import models, schemas


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
    return [row.badge_key for row in rows]


def _mock_discovery_ai(note: Optional[str]) -> dict:
    text = note or ""
    color = "橘白" if "橘" in text else "待确认"
    return {
        "ai_status": "needs_review",
        "ai_confidence": 0.72,
        "ai_summary": "AI 初审：疑似未入库校园猫，建议猫协结合地点与照片复核。",
        "suggested_name": "新朋友",
        "suggested_color": color,
    }


def create_discovery(db: Session, image_path: Optional[str], location_name: Optional[str], latitude: Optional[float], longitude: Optional[float], note: Optional[str], user_id: int = 1) -> models.CatDiscovery:
    discovery = models.CatDiscovery(
        user_id=user_id,
        image_path=image_path,
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        note=note,
        **_mock_discovery_ai(note),
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


def init_mock_data(db: Session):
    demo_cats = [
        {"name": "小白", "nickname": "图书馆馆长", "gender": "母", "neutered": "是", "age_estimate": "3岁", "color": "白色", "personality": "温顺亲人，爱晒太阳", "story": "小白是图书馆门口的常驻馆长。她总能精准找到阳光最好的一块地砖，安静地陪同学们度过赶论文的下午。", "location": "图书馆", "avatar": "/uploads/cats/xiaobai.jpg"},
        {"name": "橘子", "nickname": "二食堂饭搭子", "gender": "公", "neutered": "是", "age_estimate": "4岁", "color": "橘色", "personality": "贪吃，社牛，会撒娇", "story": "橘子熟悉二食堂每一条路线。只要听见塑料袋声，他就会迈着自信小碎步出现，像在检查今天的菜单。", "location": "二食堂", "avatar": "/uploads/cats/juzi.jpg"},
        {"name": "黑咪", "nickname": "夜巡队长", "gender": "母", "neutered": "未知", "age_estimate": "2岁", "color": "黑色", "personality": "高冷，警觉，慢热", "story": "黑咪喜欢在教学楼附近夜巡。她不轻易靠近人，但会保持三米距离默默同行，像一位沉默的晚归护卫。", "location": "教学楼", "avatar": "/uploads/cats/heimi.jpg"},
        {"name": "奶盖", "nickname": "草坪小云朵", "gender": "母", "neutered": "否", "age_estimate": "1岁", "color": "奶牛色", "personality": "活泼，好奇，爱翻肚皮", "story": "奶盖经常在图书馆草坪边冒出来，看到落叶都会认真研究半天。她的日常任务是把路过同学的心情调成晴天。", "location": "图书馆草坪", "avatar": "/uploads/cats/naigai.jpg"},
        {"name": "煤球", "nickname": "楼道影子", "gender": "公", "neutered": "是", "age_estimate": "5岁", "color": "黑白", "personality": "谨慎，聪明，认路", "story": "煤球总在光华楼附近神出鬼没。他熟悉每个避风角落，偶尔接受投喂，但更喜欢用眼神表达边界感。", "location": "光华楼", "avatar": "/uploads/cats/meiqiu.jpg"},
        {"name": "三花", "nickname": "宿舍区外交官", "gender": "母", "neutered": "是", "age_estimate": "3岁", "color": "三花", "personality": "亲人，话多，爱蹭腿", "story": "三花是宿舍区最会打招呼的猫。她会在晚饭后准时营业，用一串喵喵声通知大家今天也要好好生活。", "location": "宿舍区", "avatar": "/uploads/cats/sanhua.jpg"},
        {"name": "豆沙", "nickname": "教学楼门神", "gender": "公", "neutered": "未知", "age_estimate": "2岁", "color": "狸花", "personality": "稳重，胆大，爱观察", "story": "豆沙喜欢守在教学楼台阶旁，像在旁听每一门课。他不急着亲近人，但会认真观察每个匆忙赶课的身影。", "location": "教学楼", "avatar": "/uploads/cats/dousha.jpg"},
        {"name": "雪糕", "nickname": "晨跑陪练", "gender": "母", "neutered": "否", "age_estimate": "1岁半", "color": "白橘", "personality": "敏捷，胆小，爱追影子", "story": "雪糕常在清晨出现在草坪边。她跑得很快，像一团会移动的小火苗，只在安全距离内给晨跑同学加油。", "location": "图书馆草坪", "avatar": "/uploads/cats/xuegao.jpg"},
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

    for name, cat_id in cat_ids.items():
        if db.query(models.CatImage).filter(models.CatImage.cat_id == cat_id).count() == 0:
            slug = {
                "小白": "xiaobai",
                "橘子": "juzi",
                "黑咪": "heimi",
                "奶盖": "naigai",
                "煤球": "meiqiu",
                "三花": "sanhua",
                "豆沙": "dousha",
                "雪糕": "xuegao",
            }[name]
            db.add(models.CatImage(cat_id=cat_id, image_path=f"/uploads/cats/{slug}_1.jpg"))

    demo_sightings = [
        ("小白", "图书馆门口", 31.3009, 121.5037, "在门口晒太阳", 0.95),
        ("橘子", "二食堂", 31.2996, 121.5018, "蹲在台阶旁边", 0.88),
        ("小白", "图书馆草坪", 31.3013, 121.5043, "草坪边巡逻", 0.92),
        ("奶盖", "图书馆草坪", 31.3013, 121.5043, "追着落叶跑了两圈", 0.86),
        ("煤球", "光华楼", 31.3001, 121.5005, "躲在柱子后面观察大家", 0.81),
        ("三花", "宿舍区", 31.3021, 121.5012, "主动蹭了三位同学", 0.9),
        ("豆沙", "教学楼", 31.2991, 121.5049, "守在台阶旁边发呆", 0.84),
        ("雪糕", "图书馆草坪", 31.3013, 121.5043, "清晨从草坪边跑过", 0.79),
    ]

    for name, location, latitude, longitude, note, confidence in demo_sightings:
        cat_id = cat_ids[name]
        existing = db.query(models.Sighting).filter(
            models.Sighting.cat_id == cat_id,
            models.Sighting.note == note,
        ).first()
        if not existing:
            db.add(models.Sighting(cat_id=cat_id, location=location, location_name=location, latitude=latitude, longitude=longitude, spotted_by="猫猫爱好者", note=note, confidence=confidence))

    user = models.User(id=1, nickname="猫猫爱好者", avatar="/uploads/avatar/default.jpg")
    if not db.query(models.User).filter(models.User.id == 1).first():
        db.add(user)

    if db.query(models.Post).count() == 0:
        seed_posts = [
            ("daily", "今天在图书馆门口又看到小白了，晒太阳晒得很认真，状态很好。", ["#小白", "#图书馆", "#治愈瞬间"], "小白"),
            ("find", "有人今天看到橘子吗？昨天在二食堂附近，今天还没见到。", ["#橘子", "#二食堂", "#求助"], "橘子"),
            ("health", "黑咪右眼看起来有点分泌物，已经记录给猫协志愿者了，大家遇到可以观察一下。", ["#黑咪", "#健康", "#猫协"], "黑咪"),
            ("suggest", "建议在地图页加一个最近24小时筛选，这样找猫会更准确。", ["#建议反馈", "#地图"], None),
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
