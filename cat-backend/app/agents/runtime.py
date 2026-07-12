import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.agents import provider, tools
from app.agents.cat_intel import GENERIC_LIMITATION, answer_cat_intel
from app.agents.schemas import CatIntelAction, CatIntelEvidence, CatIntelRequest, CatIntelResponse
from app.config import settings

SYSTEM_PROMPT = """你是猫猫社区的猫情报 Agent。你必须先调用工具获取事实，再回答用户。
只陈述工具返回的已审核社区观测；历史出现不是实时位置，不能保证遇见。回答使用简洁中文，说明时间窗口和样本量。
不要建议投喂。工具没有数据时明确说不知道。不要编造猫名、地点、天气或记录。"""

TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "cat_activity", "description": "查询一只猫近14天的活动记录", "parameters": {"type": "object", "properties": {"cat_name": {"type": "string"}}, "required": ["cat_name"]}}},
    {"type": "function", "function": {"name": "location_activity", "description": "查询地点近14天的猫活动", "parameters": {"type": "object", "properties": {"location": {"type": "string"}}, "required": ["location"]}}},
    {"type": "function", "function": {"name": "hotspots", "description": "查询近14天校园热点", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "nearby_activity", "description": "根据坐标查询1公里内活动", "parameters": {"type": "object", "properties": {"latitude": {"type": "number"}, "longitude": {"type": "number"}}, "required": ["latitude", "longitude"]}}},
]


def run_cat_intel(db: Session, request: CatIntelRequest) -> CatIntelResponse:
    if not provider.is_configured():
        return answer_cat_intel(db, request)
    context = request.context.model_dump(mode="json", exclude_none=True)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": f"用户上下文：{json.dumps(context, ensure_ascii=False)}\n问题：{request.message}"}]
    evidence = []
    actions = []
    try:
        for _ in range(settings.AGENT_MAX_TOOL_CALLS):
            reply = provider.complete(messages, TOOL_DEFINITIONS)
            calls = reply.get("tool_calls") or []
            if not calls:
                content = (reply.get("content") or "").strip()
                if not content or not evidence:
                    break
                return CatIntelResponse(answer=content, mode="agent", intent="tool_answer", confidence=_quality(evidence), evidence=evidence, actions=actions, limitations=[GENERIC_LIMITATION], generated_at=datetime.now())
            messages.append(reply)
            for call in calls:
                result, new_evidence, new_actions = _execute(db, call, request)
                evidence.extend(new_evidence)
                actions.extend(new_actions)
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result, ensure_ascii=False, default=str)})
    except (provider.AgentProviderError, KeyError, TypeError, ValueError):
        pass
    return answer_cat_intel(db, request)


def _execute(db, call, request):
    name = call["function"]["name"]
    args = provider.parse_arguments(call)
    evidence, actions = [], []
    if name == "cat_activity":
        cat = tools.find_cat(db, str(args.get("cat_name", "")))
        if not cat:
            return {"found": False}, evidence, actions
        item = tools.cat_activity(db, cat)
        result = {"cat_id": cat.id, "cat_name": cat.name, "count": item["count"], "locations": item["locations"], "periods": item["periods"], "latest": item["latest"], "quality": item["quality"]}
        actions.append(CatIntelAction(type="open_cat", label=f"查看{cat.name}档案", params={"cat_id": cat.id}))
    elif name == "location_activity":
        result = tools.location_activity(db, str(args.get("location", "")))
        actions.append(CatIntelAction(type="open_map", label="在地图中查看", params={"location": result["location"]}))
    elif name == "nearby_activity":
        lat = args.get("latitude", request.context.latitude)
        lng = args.get("longitude", request.context.longitude)
        if lat is None or lng is None:
            return {"error": "location_permission_required"}, evidence, actions
        rows = tools.nearby_activity(db, float(lat), float(lng))
        result = {"count": len(rows), "items": [{"cat_id": row["cat"].id, "cat_name": row["cat"].name, "distance_km": row["distance_km"], "observed_at": row["sighting"].created_at} for row in rows[:10]]}
        actions.append(CatIntelAction(type="open_map", label="查看附近地图"))
    else:
        result = {"items": tools.hotspots(db)}
        actions.append(CatIntelAction(type="open_map", label="查看热度地图"))
    count = result.get("count", sum(item.get("count", 0) for item in result.get("items", [])))
    latest = result.get("latest")
    evidence.append(CatIntelEvidence(label=f"近14天已审核观测 {count} 条", source="approved_sightings", observed_at=latest))
    return result, evidence, actions


def _quality(evidence):
    return "medium" if evidence else "none"
