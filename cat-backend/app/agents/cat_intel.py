from datetime import datetime

from sqlalchemy.orm import Session

from app.agents import tools
from app.agents.schemas import CatIntelAction, CatIntelEvidence, CatIntelRequest, CatIntelResponse


GENERIC_LIMITATION = "建议基于近期社区观测，不代表猫的实时位置，也不能保证一定遇见。"
LOCATION_HINTS = ("光草", "光华楼", "文图", "理图", "北区", "南区", "食堂", "三教", "四教", "五教", "六教", "相辉堂", "燕园", "曦园")


def answer_cat_intel(db: Session, request: CatIntelRequest) -> CatIntelResponse:
    message = request.message.strip()
    cat = tools.find_cat(db, message)
    if cat:
        return _answer_cat(db, cat)

    if request.context.latitude is not None and request.context.longitude is not None and any(
        word in message for word in ("附近", "周围", "我这", "这里", "哪")
    ):
        return _answer_nearby(db, request)

    location = request.context.location_name or next((item for item in LOCATION_HINTS if item in message), None)
    if location and any(word in message for word in ("猫", "活跃", "最近", "哪里", "哪只", "遇")):
        return _answer_location(db, location)

    return _answer_hotspots(db, route=any(word in message for word in ("路线", "规划", "怎么走", "半小时", "分钟")))


def _answer_cat(db: Session, cat) -> CatIntelResponse:
    activity = tools.cat_activity(db, cat)
    if not activity["count"]:
        answer = f"近期没有查到 {cat.name} 的已审核偶遇。档案常见区域是 {cat.location or '暂未记录'}，但这不能作为实时位置。"
        return _response(answer, "cat_activity", "none", actions=[_cat_action(cat.id, cat.name)], limitations=[GENERIC_LIMITATION])
    location, location_count = activity["locations"][0]
    period, period_count = activity["periods"][0]
    answer = f"近 14 天，{cat.name} 有 {activity['count']} 条已审核偶遇，最常出现在{location}（{location_count} 次），记录最多的时段是{period}（{period_count} 次）。"
    evidence = [CatIntelEvidence(label=f"{location}近 14 天记录 {location_count} 次", source="approved_sightings", observed_at=activity["latest"])]
    actions = [_cat_action(cat.id, cat.name), CatIntelAction(type="open_map", label="在地图中查看", params={"location": location})]
    return _response(answer, "cat_activity", activity["quality"], evidence, actions, [GENERIC_LIMITATION])


def _answer_location(db: Session, location: str) -> CatIntelResponse:
    activity = tools.location_activity(db, location)
    if not activity["count"]:
        return _response(f"近 14 天没有查到{location}的已审核偶遇记录。可以换一个地点查询，或到现场记录新的偶遇。", "location_activity", "none", actions=[CatIntelAction(type="open_scan", label="记录新偶遇")])
    cats = "、".join(f"{item['name']}（{item['count']} 次）" for item in activity["cats"][:3])
    answer = f"{location}近 14 天共有 {activity['count']} 条已审核偶遇，较活跃的猫有{cats}。"
    evidence = [CatIntelEvidence(label=f"{location}近 14 天记录 {activity['count']} 次", source="approved_sightings", observed_at=activity["latest"])]
    actions = [CatIntelAction(type="open_map", label="打开地点地图", params={"location": location})]
    if activity["cats"]:
        first = activity["cats"][0]
        actions.append(_cat_action(first["id"], first["name"]))
    return _response(answer, "location_activity", activity["quality"], evidence, actions, [GENERIC_LIMITATION])


def _answer_nearby(db: Session, request: CatIntelRequest) -> CatIntelResponse:
    context = request.context
    rows = tools.nearby_activity(db, context.latitude, context.longitude)
    if not rows:
        return _response("你附近 1 公里内暂时没有近 14 天的已审核偶遇记录。", "nearby_activity", "none", actions=[CatIntelAction(type="open_map", label="查看全校地图")], limitations=[GENERIC_LIMITATION])
    unique = []
    seen = set()
    for row in rows:
        if row["cat"].id not in seen:
            seen.add(row["cat"].id)
            unique.append(row)
    summary = "、".join(f"{row['cat'].name}（约 {row['distance_km']} 公里）" for row in unique[:3])
    answer = f"你附近 1 公里内近 14 天记录到 {len(rows)} 次偶遇，最近的候选包括{summary}。"
    evidence = [CatIntelEvidence(label=f"附近近 14 天有效记录 {len(rows)} 条", source="approved_sightings", observed_at=rows[0]["sighting"].created_at)]
    return _response(answer, "nearby_activity", tools.data_quality(len(rows)), evidence, [CatIntelAction(type="open_map", label="查看附近地图")], [GENERIC_LIMITATION])


def _answer_hotspots(db: Session, route: bool) -> CatIntelResponse:
    rows = tools.hotspots(db)
    intent = "route_recommendation" if route else "hotspot_summary"
    if not rows:
        return _response("目前没有偶遇记录，暂时无法生成可靠推荐。", intent, "none", actions=[CatIntelAction(type="open_scan", label="记录第一次偶遇")])
    summary = "、".join(f"{row['name']}（{row['count']} 次）" for row in rows[:3])
    prefix = "可以优先按这个顺序观察：" if route else "近期较活跃的地点是"
    answer = f"{prefix}{summary}。"
    latest = max((row["latest"] for row in rows if row["latest"]), default=None)
    evidence = [CatIntelEvidence(label=f"近 14 天共比较 {len(rows)} 个热点", source="approved_sightings", observed_at=latest)]
    actions = [CatIntelAction(type="start_route", label="生成寻猫路线", params={"time_slot": "anytime"})] if route else [CatIntelAction(type="open_map", label="查看热度地图")]
    return _response(answer, intent, tools.data_quality(sum(row["count"] for row in rows)), evidence, actions, [GENERIC_LIMITATION])


def _cat_action(cat_id: int, name: str) -> CatIntelAction:
    return CatIntelAction(type="open_cat", label=f"查看{name}档案", params={"cat_id": cat_id})


def _response(answer, intent, confidence, evidence=None, actions=None, limitations=None):
    return CatIntelResponse(answer=answer, intent=intent, confidence=confidence, evidence=evidence or [], actions=actions or [], limitations=limitations or [], generated_at=datetime.now())
