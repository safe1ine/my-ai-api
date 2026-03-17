import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from database import engine, Base

# 导入所有模型确保建表
import models  # noqa: F401

from routers import proxy, stats, providers, client_keys, logs

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI API 中转站", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proxy.router)
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
app.include_router(client_keys.router, prefix="/api/keys", tags=["keys"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])


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
