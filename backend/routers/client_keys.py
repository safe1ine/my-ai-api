import secrets
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from models import ApiLog, ClientKey
from schemas import ClientKeyTokenStats

router = APIRouter()


class KeyCreate(BaseModel):
    name: str


class KeyUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    token_limit: int | None = None  # None 表示不限制，单位 token


class KeyOut(BaseModel):
    id: int
    name: str
    key: str
    is_active: bool
    token_limit: int | None
    created_at: str

    @classmethod
    def from_orm(cls, obj: ClientKey) -> "KeyOut":
        return cls(
            id=obj.id,
            name=obj.name,
            key=obj.key,
            is_active=obj.is_active,
            token_limit=obj.token_limit,
            created_at=obj.created_at.isoformat(),
        )


@router.get("", response_model=list[KeyOut])
def list_keys(db: Session = Depends(get_db)):
    keys = db.query(ClientKey).order_by(ClientKey.created_at.desc()).all()
    return [KeyOut.from_orm(k) for k in keys]


@router.get("/token-stats", response_model=list[ClientKeyTokenStats])
def get_key_token_stats(db: Session = Depends(get_db)):
    """返回每个 client_key 的历史总计和今日输入/输出 token"""
    today_start = datetime.combine(date.today(), datetime.min.time())

    total_rows = (
        db.query(
            ApiLog.client_key_id,
            func.coalesce(func.sum(ApiLog.input_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens), 0).label("total_input"),
            func.coalesce(func.sum(ApiLog.output_tokens), 0).label("total_output"),
        )
        .filter(ApiLog.client_key_id.isnot(None))
        .group_by(ApiLog.client_key_id)
        .all()
    )
    total_map = {r.client_key_id: (int(r.total_input), int(r.total_output)) for r in total_rows}

    today_rows = (
        db.query(
            ApiLog.client_key_id,
            func.coalesce(func.sum(ApiLog.input_tokens + ApiLog.cache_read_tokens + ApiLog.cache_write_tokens), 0).label("today_input"),
            func.coalesce(func.sum(ApiLog.output_tokens), 0).label("today_output"),
        )
        .filter(ApiLog.client_key_id.isnot(None), ApiLog.created_at >= today_start)
        .group_by(ApiLog.client_key_id)
        .all()
    )
    today_map = {r.client_key_id: (int(r.today_input), int(r.today_output)) for r in today_rows}

    key_ids = db.query(ClientKey.id).all()
    result = []
    for (kid,) in key_ids:
        ti, to = total_map.get(kid, (0, 0))
        di, do_ = today_map.get(kid, (0, 0))
        result.append(ClientKeyTokenStats(
            client_key_id=kid,
            total_input_tokens=ti,
            total_output_tokens=to,
            today_input_tokens=di,
            today_output_tokens=do_,
        ))
    return result


@router.post("", response_model=KeyOut, status_code=201)
def create_key(body: KeyCreate, db: Session = Depends(get_db)):
    key_value = "sk-" + secrets.token_urlsafe(32)
    ck = ClientKey(name=body.name, key=key_value)
    db.add(ck)
    db.commit()
    db.refresh(ck)
    return KeyOut.from_orm(ck)


@router.put("/{key_id}", response_model=KeyOut)
def update_key(key_id: int, body: KeyUpdate, db: Session = Depends(get_db)):
    ck = db.get(ClientKey, key_id)
    if not ck:
        raise HTTPException(status_code=404, detail="Key not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ck, field, value)
    db.commit()
    db.refresh(ck)
    return KeyOut.from_orm(ck)


@router.delete("/{key_id}", status_code=204)
def delete_key(key_id: int, db: Session = Depends(get_db)):
    ck = db.get(ClientKey, key_id)
    if not ck:
        raise HTTPException(status_code=404, detail="Key not found")
    db.delete(ck)
    db.commit()
