import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from database import engine, Base, SessionLocal

# 导入所有模型确保建表
import models  # noqa: F401

from auth_admin import get_admin_token
from routers import proxy, stats, providers, client_keys, logs, auth

logger = logging.getLogger("main")

Base.metadata.create_all(bind=engine)

# 兼容旧数据库：按需添加新列
_migrations = [
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS proxy_url VARCHAR(500)",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_check_at TIMESTAMP",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_check_success BOOLEAN",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_check_error TEXT",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_check_latency_ms INTEGER",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5",
]
with engine.connect() as _conn:
    for _sql in _migrations:
        _conn.execute(text(_sql))
    _conn.commit()


async def _health_check_loop():
    """每 5 分钟对所有启用的上游做一次探活"""
    from models import Provider
    from routers.providers import do_health_check
    while True:
        await asyncio.sleep(300)
        db = SessionLocal()
        try:
            active_providers = db.query(Provider).filter(Provider.is_active == True).all()  # noqa: E712
            for p in active_providers:
                try:
                    await do_health_check(db, p)
                    logger.info("[health] provider=%s success=%s latency=%sms",
                                p.name, p.last_check_success, p.last_check_latency_ms)
                except Exception as e:
                    logger.warning("[health] provider=%s error: %s", p.name, e)
        finally:
            db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_health_check_loop())
    yield
    task.cancel()


app = FastAPI(title="AI API 中转站", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Depends  # noqa: E402

_admin = [Depends(get_admin_token)]

app.include_router(proxy.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"], dependencies=_admin)
app.include_router(providers.router, prefix="/api/providers", tags=["providers"], dependencies=_admin)
app.include_router(client_keys.router, prefix="/api/keys", tags=["keys"], dependencies=_admin)
app.include_router(logs.router, prefix="/api/logs", tags=["logs"], dependencies=_admin)


@app.get("/health")
async def health():
    return {"status": "ok"}


# 托管前端静态文件（Docker 构建时由 Dockerfile 注入 static/ 目录）
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    _assets_dir = os.path.join(_static_dir, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(_full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
