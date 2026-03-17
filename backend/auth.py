"""调用方 API Key 鉴权"""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models import ClientKey


def verify_client_key(request: Request, db: Session = Depends(get_db)) -> str:
    """
    从 Authorization: Bearer <key> 或 x-api-key: <key> 中提取并验证调用方 key。
    返回 key 字符串（用于日志记录）。
    """
    key = ""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        key = auth.removeprefix("Bearer ").strip()
    if not key:
        key = request.headers.get("x-api-key", "").strip()
    if not key:
        raise HTTPException(status_code=401, detail="缺少 API Key（Authorization 或 x-api-key）")


    record = db.query(ClientKey).filter(ClientKey.key == key, ClientKey.is_active == True).first()  # noqa: E712
    if not record:
        raise HTTPException(status_code=401, detail="无效或已禁用的 API Key")
    return key
