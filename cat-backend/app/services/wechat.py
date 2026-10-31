import logging
import hashlib
import httpx

from app.config import settings

logger = logging.getLogger("cat_community.wechat")

async def code2session(code: str) -> dict:
    if not code.strip():
        raise ValueError("WeChat code must not be empty")
    if settings.WECHAT_DEV_MODE:
        logger.warning("WECHAT_DEV_MODE is enabled: using a simulated identity")
        identity = hashlib.sha256(code.encode("utf-8")).hexdigest()
        return {"openid": f"dev_{identity}", "session_key": "dev_session_key"}
    if not settings.WECHAT_APPID or not settings.WECHAT_SECRET:
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
        resp.raise_for_status()
        data = resp.json()
        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"WeChat login failed: {data.get('errmsg', 'unknown')}")
        return data


async def get_access_token() -> str:
    if settings.WECHAT_DEV_MODE:
        return "dev_access_token"
    if not settings.WECHAT_APPID or not settings.WECHAT_SECRET:
        raise ValueError("WeChat credentials not configured (WECHAT_APPID/WECHAT_SECRET)")
    url = "https://api.weixin.qq.com/cgi-bin/token"
    params = {
        "appid": settings.WECHAT_APPID,
        "secret": settings.WECHAT_SECRET,
        "grant_type": "client_credential",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        token = resp.json().get("access_token")
        if not token:
            raise ValueError("WeChat access token request failed")
        return token


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
