"""
管理面板身份验证
- ADMIN_USERNAME：从环境变量读取，默认 admin
- ADMIN_PASSWORD：从环境变量读取；未设置时每次启动自动生成随机密码并打印到日志
- 登录后颁发随机 token，有效期 24 小时
- token 存内存；服务重启后需重新登录
"""
import logging
import os
import secrets
from datetime import datetime, timedelta

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

TOKEN_TTL = timedelta(hours=24)

# token → 过期时间
_tokens: dict[str, datetime] = {}


def create_token() -> str:
    token = secrets.token_urlsafe(32)
    _tokens[token] = datetime.utcnow() + TOKEN_TTL
    return token


def revoke_token(token: str) -> None:
    _tokens.pop(token, None)


def _verify(token: str) -> bool:
    expiry = _tokens.get(token)
    if not expiry:
        return False
    if datetime.utcnow() > expiry:
        _tokens.pop(token, None)
        return False
    return True


def get_admin_token(request: Request) -> str:
    """FastAPI 依赖：从 Authorization: Bearer <token> 头中验证管理员 token"""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if _verify(token):
            return token
    raise HTTPException(status_code=401, detail="未登录或登录已过期")
