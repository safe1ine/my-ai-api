import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import ClientKey

router = APIRouter()


class KeyCreate(BaseModel):
    name: str


class KeyUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class KeyOut(BaseModel):
    id: int
    name: str
    key: str
    is_active: bool
    created_at: str

    @classmethod
    def from_orm(cls, obj: ClientKey) -> "KeyOut":
        return cls(
            id=obj.id,
            name=obj.name,
            key=obj.key,
            is_active=obj.is_active,
            created_at=obj.created_at.isoformat(),
        )


@router.get("", response_model=list[KeyOut])
def list_keys(db: Session = Depends(get_db)):
    keys = db.query(ClientKey).order_by(ClientKey.created_at.desc()).all()
    return [KeyOut.from_orm(k) for k in keys]


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
