import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from database import engine, Base, SessionLocal

# 配置日志级别
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 导入所有模型确保建表
import models  # noqa: F401

from auth_admin import get_admin_token
from routers import proxy, stats, providers, client_keys, logs, auth

logger = logging.getLogger("main")

Base.metadata.create_all(bind=engine)

# 兼容旧数据库：按需添加新列 (支持 SQLite 和 PostgreSQL)
_migrations = [
    ("providers", "group_name", "ALTER TABLE providers ADD COLUMN group_name VARCHAR(100)"),
    ("providers", "proxy_url", "ALTER TABLE providers ADD COLUMN proxy_url VARCHAR(500)"),
    ("providers", "last_check_at", "ALTER TABLE providers ADD COLUMN last_check_at TIMESTAMP"),
    ("providers", "last_check_success", "ALTER TABLE providers ADD COLUMN last_check_success BOOLEAN"),
    ("providers", "last_check_error", "ALTER TABLE providers ADD COLUMN last_check_error TEXT"),
    ("providers", "last_check_latency_ms", "ALTER TABLE providers ADD COLUMN last_check_latency_ms INTEGER"),
    ("providers", "priority", "ALTER TABLE providers ADD COLUMN priority INTEGER DEFAULT 5"),
    ("providers", "skip_health_check", "ALTER TABLE providers ADD COLUMN skip_health_check BOOLEAN DEFAULT FALSE"),
    ("api_logs", "first_token_latency_ms", "ALTER TABLE api_logs ADD COLUMN first_token_latency_ms INTEGER DEFAULT 0"),
    ("api_logs", "is_stream", "ALTER TABLE api_logs ADD COLUMN is_stream BOOLEAN DEFAULT FALSE"),
    ("api_logs", "cache_read_tokens", "ALTER TABLE api_logs ADD COLUMN cache_read_tokens INTEGER DEFAULT 0"),
    ("api_logs", "cache_write_tokens", "ALTER TABLE api_logs ADD COLUMN cache_write_tokens INTEGER DEFAULT 0"),
    ("api_logs", "key_name", "ALTER TABLE api_logs ADD COLUMN key_name VARCHAR(100) NOT NULL DEFAULT 'unknown'"),
    ("api_logs", "client_ip", "ALTER TABLE api_logs ADD COLUMN client_ip VARCHAR(45)"),
    ("client_keys", "token_limit", "ALTER TABLE client_keys ADD COLUMN token_limit INTEGER"),
]

# 单独处理需要修改约束的迁移（PostgreSQL only）
_constraint_migrations = [
    "ALTER TABLE api_logs ALTER COLUMN api_key_prefix DROP NOT NULL",
]

def _column_exists(conn, table_name: str, column_name: str) -> bool:
    """检查列是否存在，兼容 SQLite 和 PostgreSQL"""
    db_url = str(engine.url)
    if "sqlite" in db_url:
        # SQLite: 使用 PRAGMA
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        columns = [row[1] for row in result]
        return column_name in columns
    else:
        # PostgreSQL: 使用 information_schema
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column AND table_schema = 'public'"
        ), {"table": table_name, "column": column_name})
        return result.fetchone() is not None

with engine.connect() as _conn:
    for table_name, column_name, _sql in _migrations:
        try:
            if not _column_exists(_conn, table_name, column_name):
                _conn.execute(text(_sql))
        except Exception:
            logger.exception("migration failed for %s.%s with SQL: %s", table_name, column_name, _sql)
    # PostgreSQL only：修改列约束
    if "sqlite" not in str(engine.url):
        for _sql in _constraint_migrations:
            try:
                _conn.execute(text(_sql))
            except Exception:
                logger.exception("constraint migration failed with SQL: %s", _sql)
    _conn.commit()


app = FastAPI(title="AI API 中转站", version="1.0.0")

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
