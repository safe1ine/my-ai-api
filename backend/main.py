from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
