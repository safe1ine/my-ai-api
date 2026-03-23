from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case, literal_column
from sqlalchemy.orm import Session
from database import get_db, engine
from models import ApiLog, LogStatus
from schemas import ApiKeyStat, ModelStat, StatsOverview, UsagePoint

router = APIRouter()


def _get_bucket_expr(bucket_minutes: int):
    """生成兼容 SQLite 和 PostgreSQL 的时间桶表达式"""
    is_sqlite = engine.dialect.name == "sqlite"
    
    if bucket_minutes < 60:
        if is_sqlite:
            # SQLite: 按 Unix 时间戳除以分钟取整再转回 datetime
            bucket_sql = f"datetime((strftime('%s', created_at) / {bucket_minutes * 60}) * {bucket_minutes * 60}, 'unixepoch')"
        else:
            # PostgreSQL
            bucket_sql = f"date_trunc('hour', created_at) + (extract(minute from created_at)::int / {bucket_minutes}) * interval '{bucket_minutes} minutes'"
    else:
        hours = bucket_minutes // 60
        if is_sqlite:
            bucket_sql = f"datetime((strftime('%s', created_at) / {bucket_minutes * 60}) * {bucket_minutes * 60}, 'unixepoch')"
        else:
            bucket_sql = f"date_trunc('day', created_at) + (extract(hour from created_at)::int / {hours}) * interval '{hours} hours'"
    
    return literal_column(bucket_sql)


@router.get("/overview", response_model=StatsOverview)
def get_overview(db: Session = Depends(get_db)):
    total = db.query(func.count(ApiLog.id)).scalar() or 0
    success = db.query(func.count(ApiLog.id)).filter(ApiLog.status == LogStatus.success).scalar() or 0
    agg = db.query(
        func.sum(ApiLog.input_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens),
        func.sum(ApiLog.output_tokens),
        func.sum(ApiLog.input_tokens + ApiLog.output_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens),
        func.sum(ApiLog.cache_read_tokens),
        func.sum(ApiLog.cache_write_tokens),
    ).first()
    return StatsOverview(
        total_requests=total,
        success_requests=success,
        error_requests=total - success,
        total_input_tokens=agg[0] or 0,
        total_output_tokens=agg[1] or 0,
        total_tokens=agg[2] or 0,
        total_cache_read_tokens=agg[3] or 0,
        total_cache_write_tokens=agg[4] or 0,
    )


@router.get("/usage", response_model=list[UsagePoint])
def get_usage(
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    db: Session = Depends(get_db),
):
    is_sqlite = engine.dialect.name == "sqlite"
    now = datetime.utcnow()
    if granularity == "day":
        start_dt = now - timedelta(hours=24)
        bucket_minutes = 15
    elif granularity == "week":
        start_dt = now - timedelta(days=7)
        bucket_minutes = 60
    else:
        start_dt = now - timedelta(days=30)
        bucket_minutes = 360

    bucket_expr = _get_bucket_expr(bucket_minutes)

    rows = (
        db.query(
            bucket_expr.label("bucket"),
            func.sum(ApiLog.input_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens).label("input_tokens"),
            func.sum(ApiLog.output_tokens).label("output_tokens"),
            func.sum(ApiLog.input_tokens + ApiLog.output_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens).label("total_tokens"),
            func.count(ApiLog.id).label("requests"),
            func.sum(case((ApiLog.status == LogStatus.success, 1), else_=0)).label("success_requests"),
            func.avg(ApiLog.latency_ms).label("avg_latency_ms"),
            func.avg(case((ApiLog.is_stream == True, ApiLog.first_token_latency_ms), else_=None)).label("avg_first_token_latency_ms"),  # noqa: E712
        )
        .filter(ApiLog.created_at >= start_dt)
        .group_by(bucket_expr)
        .order_by(bucket_expr)
        .all()
    )

    # 统一 bucket 为字符串 key（SQLite 返回字符串，PostgreSQL 返回 datetime）
    def to_bucket_key(dt):
        if isinstance(dt, str):
            return dt.replace(" ", "T")  # SQLite: "2026-03-17 23:25:00" -> "2026-03-17T23:25:00"
        return dt.strftime("%Y-%m-%dT%H:%M:%S")  # PostgreSQL datetime
    
    data: dict[str, tuple] = {to_bucket_key(r.bucket): r for r in rows}

    # 生成时间桶游标（用字符串格式）
    def format_bucket(dt: datetime) -> str:
        return dt.strftime("%Y-%m-%dT%H:%M:%S")

    # 对齐起始桶边界
    if bucket_minutes < 60:
        cursor = start_dt.replace(
            minute=(start_dt.minute // bucket_minutes) * bucket_minutes,
            second=0, microsecond=0,
        )
    else:
        hours = bucket_minutes // 60
        cursor = start_dt.replace(
            hour=(start_dt.hour // hours) * hours,
            minute=0, second=0, microsecond=0,
        )

    result: list[UsagePoint] = []
    delta = timedelta(minutes=bucket_minutes)
    while cursor <= now:
        key = format_bucket(cursor)
        r = data.get(key)
        result.append(UsagePoint(
            date=key,
            input_tokens=r.input_tokens or 0 if r else 0,
            output_tokens=r.output_tokens or 0 if r else 0,
            total_tokens=r.total_tokens or 0 if r else 0,
            requests=r.requests or 0 if r else 0,
            success_requests=r.success_requests or 0 if r else 0,
            avg_latency_ms=int(r.avg_latency_ms or 0) if r else 0,
            avg_first_token_latency_ms=int(r.avg_first_token_latency_ms or 0) if r else 0,
        ))
        cursor += delta
    return result


@router.get("/by-model", response_model=list[ModelStat])
def get_by_model(db: Session = Depends(get_db)):
    rows = (
        db.query(
            ApiLog.model,
            func.sum(ApiLog.input_tokens + ApiLog.output_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens).label("total_tokens"),
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
            ApiLog.key_name.label("api_key_prefix"),
            func.sum(ApiLog.input_tokens + ApiLog.output_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens).label("total_tokens"),
            func.count(ApiLog.id).label("requests"),
        )
        .group_by(ApiLog.key_name)
        .order_by(func.sum(ApiLog.total_tokens).desc())
        .all()
    )
    return [
        ApiKeyStat(api_key_prefix=r.api_key_prefix, total_tokens=r.total_tokens or 0, requests=r.requests or 0)
        for r in rows
    ]
