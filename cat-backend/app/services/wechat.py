import logging
import httpx
from typing import Optional

from app.config import settings

logger = logging.getLogger("cat_community.wechat")

WECHAT_DEV_MODE = settings.WECHAT_APPID == "" and settings.WECHAT_SECRET == ""


async def code2session(code: str) -> dict:
    if not settings.WECHAT_APPID or not settings.WECHAT_SECRET:
        if WECHAT_DEV_MODE:
            logger.warning("WECHAT_DEV_MODE: forging openid for code %s (DO NOT use in production)", code[:8])
            return {"openid": f"dev_openid_{code[:8]}", "session_key": "dev_session_key"}
        raise Exception("WeChat credentials not configured (WECHAT_APPID/WECHAT_SECRET)")
    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": settings.WECHAT_APPID,
        "secret": settings.WECHAT_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        data = resp.json()
        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"WeChat login failed: {data.get('errmsg', 'unknown')}")
        return data


async def get_access_token() -> str:
    if not settings.WECHAT_APPID or not settings.WECHAT_SECRET:
        return "dev_access_token"
    url = "https://api.weixin.qq.com/cgi-bin/token"
    params = {
        "appid": settings.WECHAT_APPID,
        "secret": settings.WECHAT_SECRET,
        "grant_type": "client_credential",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        return resp.json().get("access_token", "")


async def send_template_message(openid: str, template_id: str, data: dict, page: str = "") -> bool:
    token = await get_access_token()
    if token == "dev_access_token":
        logger.debug("Template message: openid=%s, data=%s", openid, data)
        return True
    url = f"https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token={token}"
    body = {
        "touser": openid,
        "template_id": template_id,
        "page": page,
        "data": data,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body)
        result = resp.json()
        return result.get("errcode") == 0
