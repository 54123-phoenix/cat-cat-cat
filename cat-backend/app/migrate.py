import logging

from sqlalchemy import inspect as _inspect
from app.database import engine

logger = logging.getLogger("cat_community.migrate")


def ensure_users_columns():
    try:
        insp = _inspect(engine)
        if "users" not in insp.get_table_names():
            return
        existing = {c["name"] for c in insp.get_columns("users")}
        for col, ddl in [
            ("xp", "xp INTEGER DEFAULT 0"),
            ("level", "level INTEGER DEFAULT 1"),
            ("longest_streak", "longest_streak INTEGER DEFAULT 0"),
            ("token_version", "token_version INTEGER DEFAULT 1"),
        ]:
            if col not in existing:
                with engine.begin() as conn:
                    conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {ddl}")
    except Exception as e:
        logger.warning("Schema migration for users failed: %s", e)


def ensure_sightings_columns():
    try:
        insp = _inspect(engine)
        if "sightings" not in insp.get_table_names():
            return
        existing = {c["name"] for c in insp.get_columns("sightings")}
        for col, ddl in [
            ("user_id", "user_id INTEGER"),
            ("confirmations", "confirmations INTEGER DEFAULT 0"),
            ("grade", "grade VARCHAR(20) DEFAULT 'casual'"),
            ("weather", "weather VARCHAR(20)"),
            ("mood", "mood VARCHAR(20)"),
        ]:
            if col not in existing:
                with engine.begin() as conn:
                    conn.exec_driver_sql(f"ALTER TABLE sightings ADD COLUMN {ddl}")
    except Exception as e:
        logger.warning("Schema migration for sightings failed: %s", e)


def ensure_cats_columns():
    try:
        insp = _inspect(engine)
        if "cats" not in insp.get_table_names():
            return
        existing = {c["name"] for c in insp.get_columns("cats")}
        for col, ddl in [
            ("personality_radar", "personality_radar TEXT"),
            ("quote", "quote VARCHAR(120)"),
            ("aliases", "aliases VARCHAR(120)"),
            ("relationships", "relationships TEXT"),
        ]:
            if col not in existing:
                with engine.begin() as conn:
                    conn.exec_driver_sql(f"ALTER TABLE cats ADD COLUMN {ddl}")
    except Exception as e:
        logger.warning("Schema migration for cats failed: %s", e)


def ensure_posts_columns():
    try:
        insp = _inspect(engine)
        if "posts" not in insp.get_table_names():
            return
        existing = {c["name"] for c in insp.get_columns("posts")}
        for col, ddl in [
            ("post_type", "post_type VARCHAR(20) DEFAULT 'discussion'"),
            ("poll_options", "poll_options TEXT"),
            ("poll_data", "poll_data TEXT"),
            ("accepted_comment_id", "accepted_comment_id INTEGER"),
        ]:
            if col not in existing:
                with engine.begin() as conn:
                    conn.exec_driver_sql(f"ALTER TABLE posts ADD COLUMN {ddl}")
    except Exception as e:
        logger.warning("Schema migration for posts failed: %s", e)
