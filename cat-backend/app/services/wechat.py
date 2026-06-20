import os
import httpx
from typing import Optional

WECHAT_APPID = os.getenv("WECHAT_APPID", "")
WECHAT_SECRET = os.getenv("WECHAT_SECRET", "")
WECHAT_DEV_MODE = os.getenv("WECHAT_DEV_MODE", "") == "1"

async def code2session(code: str) -> dict:
    """Exchange wx.login code for openid and session_key"""
    if not WECHAT_APPID or not WECHAT_SECRET:
        if WECHAT_DEV_MODE:
            print(f"[WARN] WECHAT_DEV_MODE=1: forging openid for code {code[:8]} (DO NOT use in production)")
            return {"openid": f"dev_openid_{code[:8]}", "session_key": "dev_session_key"}
        raise Exception("WeChat credentials not configured (WECHAT_APPID/WECHAT_SECRET)")
    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": WECHAT_APPID,
        "secret": WECHAT_SECRET,
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
    """Get WeChat access token for template messages"""
    if not WECHAT_APPID or not WECHAT_SECRET:
        return "dev_access_token"
    url = "https://api.weixin.qq.com/cgi-bin/token"
    params = {
        "appid": WECHAT_APPID,
        "secret": WECHAT_SECRET,
        "grant_type": "client_credential",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        return resp.json().get("access_token", "")


async def send_template_message(openid: str, template_id: str, data: dict, page: str = "") -> bool:
    """Send WeChat template message"""
    token = await get_access_token()
    if token == "dev_access_token":
        print(f"[DEV] Template message: openid={openid}, data={data}")
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
