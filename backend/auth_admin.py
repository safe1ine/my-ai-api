"""
管理面板身份验证（JWT 版）
- ADMIN_USERNAME：从环境变量读取，默认 admin
- ADMIN_PASSWORD：从环境变量读取；未设置时每次启动自动生成随机密码并打印到日志
- JWT_SECRET：签名密钥，未设置时从 ADMIN_PASSWORD 派生（重启后仍有效）
- 登录后颁发 JWT，有效期 30 天
"""
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request

logger = logging.getLogger("auth_admin")

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")

_env_password = os.environ.get("ADMIN_PASSWORD")
if _env_password:
    ADMIN_PASSWORD = _env_password
else:
    ADMIN_PASSWORD = secrets.token_urlsafe(12)
    logger.info("=" * 52)
    logger.info("  未设置 ADMIN_PASSWORD，本次启动随机密码为：")
    logger.info("  用户名: %s", ADMIN_USERNAME)
    logger.info("  密  码: %s", ADMIN_PASSWORD)
    logger.info("  服务重启后密码将重新生成")
    logger.info("=" * 52)

# 签名密钥：优先读环境变量，否则从密码派生（稳定，重启不失效）
_env_secret = os.environ.get("JWT_SECRET")
JWT_SECRET = _env_secret if _env_secret else hashlib.sha256(f"ai-api:{ADMIN_PASSWORD}".encode()).hexdigest()
JWT_ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=30)


def create_token() -> str:
    payload = {
        "sub": ADMIN_USERNAME,
        "exp": datetime.now(tz=timezone.utc) + TOKEN_TTL,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def revoke_token(token: str) -> None:
    # JWT 无需服务端撤销，客户端删除 token 即可
    pass


def _verify(token: str) -> bool:
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return True
    except jwt.ExpiredSignatureError:
        return False
    except jwt.InvalidTokenError:
        return False


def get_admin_token(request: Request) -> str:
    """FastAPI 依赖：从 Authorization: Bearer <token> 头中验证管理员 token"""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if _verify(token):
            return token
    raise HTTPException(status_code=401, detail="未登录或登录已过期")
