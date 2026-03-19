from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
import enum


class ProviderType(str, enum.Enum):
    openai = "openai"
    anthropic = "anthropic"


class LogStatus(str, enum.Enum):
    success = "success"
    error = "error"


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[ProviderType] = mapped_column(SAEnum(ProviderType), nullable=False)
    api_key: Mapped[str] = mapped_column(String(500), nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proxy_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=5)
    skip_health_check: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_check_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_check_success: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    last_check_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_check_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    logs: Mapped[list["ApiLog"]] = relationship("ApiLog", back_populates="provider")


class ClientKey(Base):
    __tablename__ = "client_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ApiLog(Base):
    __tablename__ = "api_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("providers.id"), nullable=True)
    client_key_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("client_keys.id"), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    key_name: Mapped[str] = mapped_column(String(100), nullable=False, default="unknown")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[LogStatus] = mapped_column(SAEnum(LogStatus), default=LogStatus.success)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    request_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    first_token_latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    is_stream: Mapped[bool] = mapped_column(Boolean, default=False)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, default=0)

    provider: Mapped["Provider | None"] = relationship("Provider", back_populates="logs")
    client_key: Mapped["ClientKey | None"] = relationship("ClientKey")
