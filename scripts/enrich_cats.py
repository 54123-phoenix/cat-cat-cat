import sys
import os
import json
import hashlib

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'cat-backend'))

from app.database import SessionLocal, engine, Base
from app.models import Cat
from app.migrate import ensure_cats_columns


CAT_QUOTES = [
    "别拍我，让我再睡五分钟",
    "今天的小鱼干呢？",
    "本喵今日营业结束",
    "看什么看，没见过帅哥吗？",
    "再摸一下就咬你哦",
    "罐头呢？罐头呢？罐头呢？",
    "今天的阳光刚好适合打盹",
    "人类，你又来打扰我了",
    "本喵心情不错，允许你摸一下",
    "别挡路，我要去巡视领地了",
    "饿饿，饭饭，快点快点",
    "这个纸箱归我了，不服来战",
    "今日份的晒太阳已完成",
    "别叫我名字，叫我陛下",
    "又来拍我？给小鱼干了吗？",
    "本喵正在思考猫生，勿扰",
    "今天也是不想动的一天",
    "看到那只鸟了吗？可惜我够不到",
    "人类，你的膝盖归我了",
    "营业中：接受投喂，不接受摸肚子",
]


def stable_hash(name):
    return int(hashlib.md5(name.encode('utf-8')).hexdigest(), 16)


def gen_radar(name):
    h = stable_hash(name)
    vals = []
    for i in range(5):
        vals.append(((h >> (i * 7)) & 0x7) % 5 + 1)
    return vals


def gen_quote(name):
    h = stable_hash(name)
    return CAT_QUOTES[h % len(CAT_QUOTES)]


def gen_aliases(cat):
    if not cat.color:
        return ''
    color = cat.color.strip()
    aliases_map = {
        '橘': '小橘,橘宝',
        '黑': '小黑,黑煤球',
        '白': '小白,雪球',
        '狸': '小狸,狸花',
        '灰': '小灰,灰灰',
        '三花': '花花,三花妹',
        '奶牛': '奶牛,奥利奥',
    }
    for key, val in aliases_map.items():
        if key in color:
            return val
    return ''


def main():
    Base.metadata.create_all(bind=engine)
    ensure_cats_columns()
    db = SessionLocal()
    try:
        cats = db.query(Cat).all()
        updated = 0
        for cat in cats:
            changed = False
            if not cat.personality_radar:
                cat.personality_radar = json.dumps(gen_radar(cat.name), ensure_ascii=False)
                changed = True
            if not cat.quote:
                cat.quote = gen_quote(cat.name)
                changed = True
            if not cat.aliases:
                aliases = gen_aliases(cat)
                if aliases:
                    cat.aliases = aliases
                    changed = True
            if changed:
                updated += 1
        db.commit()
        print(f"Processed {len(cats)} cats, updated {updated}.")
    finally:
        db.close()


if __name__ == '__main__':
    main()
