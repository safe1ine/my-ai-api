from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict


# ── Provider ──────────────────────────────────────────────
class ProviderBase(BaseModel):
    name: str
    type: Literal["openai", "anthropic"]
    api_key: str
    base_url: str | None = None
    proxy_url: str | None = None
    is_active: bool = True
    priority: int = 5


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    name: str | None = None
    type: Literal["openai", "anthropic"] | None = None
    api_key: str | None = None
    base_url: str | None = None
    proxy_url: str | None = None
    is_active: bool | None = None
    priority: int | None = None


class ProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    api_key_prefix: str = ""      # 脱敏后只显示前缀
    base_url: str | None
    proxy_url: str | None
    is_active: bool
    priority: int = 5
    created_at: datetime
    last_check_at: datetime | None = None
    last_check_success: bool | None = None
    last_check_error: str | None = None
    last_check_latency_ms: int | None = None

    @classmethod
    def from_orm_with_mask(cls, obj: Any) -> "ProviderOut":
        key = obj.api_key or ""
        prefix = key[:8] + "****" if len(key) >= 8 else "****"
        return cls(
            id=obj.id,
            name=obj.name,
            type=obj.type,
            api_key_prefix=prefix,
            base_url=obj.base_url,
            proxy_url=obj.proxy_url,
            is_active=obj.is_active,
            priority=obj.priority if obj.priority is not None else 5,
            created_at=obj.created_at,
            last_check_at=obj.last_check_at,
            last_check_success=obj.last_check_success,
            last_check_error=obj.last_check_error,
            last_check_latency_ms=obj.last_check_latency_ms,
        )


class ProviderDetail(BaseModel):
    """编辑时使用，含真实 API Key"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    api_key: str
    base_url: str | None
    proxy_url: str | None
    is_active: bool
    priority: int = 5
    created_at: datetime


# ── Stats ─────────────────────────────────────────────────
class StatsOverview(BaseModel):
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    success_requests: int
    error_requests: int
    total_cache_read_tokens: int
    total_cache_write_tokens: int


class UsagePoint(BaseModel):
    date: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    requests: int
    success_requests: int
    avg_latency_ms: int = 0
    avg_first_token_latency_ms: int = 0


class ModelStat(BaseModel):
    model: str
    total_tokens: int
    requests: int


class ApiKeyStat(BaseModel):
    api_key_prefix: str
    total_tokens: int
    requests: int


class ProviderTokenStats(BaseModel):
    provider_id: int
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    today_input_tokens: int = 0
    today_output_tokens: int = 0


# ── Proxy (OpenAI 兼容格式) ───────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str | list[Any]


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None


# ── Anthropic 兼容格式 ────────────────────────────────────
class AnthropicMessageRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    max_tokens: int = 1024
    stream: bool = False
    system: str | None = None
