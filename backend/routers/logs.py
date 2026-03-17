from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import ApiLog

router = APIRouter()


class LogOut(BaseModel):
    id: int
    provider_name: str | None
    key_name: str | None
    model: str
    api_key_prefix: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    status: str
    latency_ms: int
    created_at: str
    request_summary: str | None = None
    response_summary: str | None = None
    error_message: str | None = None
    client_ip: str | None = None
    first_token_latency_ms: int = 0


class LogsResponse(BaseModel):
    total: int
    items: list[LogOut]


@router.get("", response_model=LogsResponse)
def list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, pattern="^(success|error)$"),
    model: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(ApiLog)
    if status:
        q = q.filter(ApiLog.status == status)
    if model:
        q = q.filter(ApiLog.model.contains(model))

    total = q.count()
    rows = q.order_by(ApiLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [
        LogOut(
            id=r.id,
            provider_name=r.provider.name if r.provider else None,
            key_name=r.client_key.name if r.client_key else None,
            model=r.model,
            api_key_prefix=r.api_key_prefix,
            input_tokens=r.input_tokens,
            output_tokens=r.output_tokens,
            total_tokens=r.total_tokens,
            status=r.status,
            latency_ms=r.latency_ms,
            created_at=r.created_at.isoformat(),
            request_summary=r.request_summary,
            response_summary=r.response_summary,
            error_message=r.error_message,
            client_ip=r.client_ip,
            first_token_latency_ms=r.first_token_latency_ms,
        )
        for r in rows
    ]
    return LogsResponse(total=total, items=items)
