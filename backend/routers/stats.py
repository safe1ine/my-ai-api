from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from models import ApiLog, LogStatus
from schemas import ApiKeyStat, ModelStat, StatsOverview, UsagePoint

router = APIRouter()


@router.get("/overview", response_model=StatsOverview)
def get_overview(db: Session = Depends(get_db)):
    total = db.query(func.count(ApiLog.id)).scalar() or 0
    success = db.query(func.count(ApiLog.id)).filter(ApiLog.status == LogStatus.success).scalar() or 0
    agg = db.query(
        func.sum(ApiLog.input_tokens),
        func.sum(ApiLog.output_tokens),
        func.sum(ApiLog.total_tokens),
    ).first()
    return StatsOverview(
        total_requests=total,
        success_requests=success,
        error_requests=total - success,
        total_input_tokens=agg[0] or 0,
        total_output_tokens=agg[1] or 0,
        total_tokens=agg[2] or 0,
    )


@router.get("/usage", response_model=list[UsagePoint])
def get_usage(
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
):
    # 默认最近 30 天
    end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=30)

    if start:
        start_dt = datetime.fromisoformat(start)
    if end:
        end_dt = datetime.fromisoformat(end)

    # SQLite 用 strftime 直接返回字符串，避免 cast(Date) 的类型转换问题
    date_col = func.strftime('%Y-%m-%d', ApiLog.created_at).label("date")
    rows = (
        db.query(
            date_col,
            func.sum(ApiLog.input_tokens).label("input_tokens"),
            func.sum(ApiLog.output_tokens).label("output_tokens"),
            func.sum(ApiLog.total_tokens).label("total_tokens"),
            func.count(ApiLog.id).label("requests"),
        )
        .filter(ApiLog.created_at >= start_dt, ApiLog.created_at <= end_dt)
        .group_by(date_col)
        .order_by(date_col)
        .all()
    )
    return [
        UsagePoint(
            date=str(r.date),
            input_tokens=r.input_tokens or 0,
            output_tokens=r.output_tokens or 0,
            total_tokens=r.total_tokens or 0,
            requests=r.requests or 0,
        )
        for r in rows
    ]


@router.get("/by-model", response_model=list[ModelStat])
def get_by_model(db: Session = Depends(get_db)):
    rows = (
        db.query(
            ApiLog.model,
            func.sum(ApiLog.total_tokens).label("total_tokens"),
            func.count(ApiLog.id).label("requests"),
        )
        .group_by(ApiLog.model)
        .order_by(func.sum(ApiLog.total_tokens).desc())
        .all()
    )
    return [ModelStat(model=r.model, total_tokens=r.total_tokens or 0, requests=r.requests or 0) for r in rows]


@router.get("/by-apikey", response_model=list[ApiKeyStat])
def get_by_apikey(db: Session = Depends(get_db)):
    rows = (
        db.query(
            ApiLog.api_key_prefix,
            func.sum(ApiLog.total_tokens).label("total_tokens"),
            func.count(ApiLog.id).label("requests"),
        )
        .group_by(ApiLog.api_key_prefix)
        .order_by(func.sum(ApiLog.total_tokens).desc())
        .all()
    )
    return [
        ApiKeyStat(api_key_prefix=r.api_key_prefix, total_tokens=r.total_tokens or 0, requests=r.requests or 0)
        for r in rows
    ]
