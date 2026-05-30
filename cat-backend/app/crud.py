from sqlalchemy.orm import Session
from sqlalchemy import desc
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


def get_sighting(db: Session, sighting_id: int) -> Optional[models.Sighting]:
    return db.query(models.Sighting).filter(models.Sighting.id == sighting_id).first()


def create_sighting(db: Session, sighting: schemas.SightingCreate, image_path: Optional[str] = None) -> models.Sighting:
    db_sighting = models.Sighting(**sighting.model_dump(), image_path=image_path)
    db.add(db_sighting)
    db.commit()
    db.refresh(db_sighting)
    return db_sighting


def get_user(db: Session, user_id: int = 1) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


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

    db.commit()
