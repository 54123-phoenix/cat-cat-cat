import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger("cat_community.cat_intel")


class AgentProviderError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings.AGENT_ENABLED and settings.AGENT_API_KEY and settings.AGENT_MODEL)


def complete(messages: list[dict], tool_definitions: list[dict]) -> dict:
    if not is_configured():
        raise AgentProviderError("Agent provider is not configured")
    url = f"{settings.AGENT_BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.AGENT_MODEL,
        "messages": messages,
        "tools": tool_definitions,
        "tool_choice": "auto",
        "temperature": 0.2,
    }
    try:
        with httpx.Client(timeout=settings.AGENT_TIMEOUT_SECONDS) as client:
            response = client.post(
                url,
                headers={"Authorization": f"Bearer {settings.AGENT_API_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        logger.warning("Cat intelligence provider failed: %s", exc)
        raise AgentProviderError("Agent provider request failed") from exc


def parse_arguments(tool_call: dict) -> dict:
    try:
        return json.loads(tool_call["function"].get("arguments") or "{}")
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        raise AgentProviderError("Invalid tool arguments") from exc
