from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Provider
from schemas import ProviderCreate, ProviderDetail, ProviderOut, ProviderUpdate
from services import openai_service, anthropic_service

router = APIRouter()


async def do_health_check(db: Session, provider: Provider) -> None:
    """对单个供应商执行探活并将结果写入数据库"""
    if provider.type == "openai":
        ok, err, latency = await openai_service.test_connection(
            provider.api_key, provider.base_url, provider.proxy_url
        )
    else:
        ok, err, latency = await anthropic_service.test_connection(
            provider.api_key, provider.base_url, provider.proxy_url
        )
    provider.last_check_at = datetime.utcnow()
    provider.last_check_success = ok
    provider.last_check_error = err
    provider.last_check_latency_ms = latency
    db.commit()


@router.get("", response_model=list[ProviderOut])
def list_providers(db: Session = Depends(get_db)):
    providers = db.query(Provider).order_by(Provider.created_at.desc()).all()
    return [ProviderOut.from_orm_with_mask(p) for p in providers]


@router.get("/{provider_id}", response_model=ProviderDetail)
def get_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.post("", response_model=ProviderOut, status_code=201)
def create_provider(body: ProviderCreate, db: Session = Depends(get_db)):
    provider = Provider(**body.model_dump())
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return ProviderOut.from_orm_with_mask(provider)


@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(provider_id: int, body: ProviderUpdate, db: Session = Depends(get_db)):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(provider, field, value)
    db.commit()
    db.refresh(provider)
    return ProviderOut.from_orm_with_mask(provider)


@router.delete("/{provider_id}", status_code=204)
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(provider)
    db.commit()


@router.post("/{provider_id}/test")
async def test_provider(provider_id: int, db: Session = Depends(get_db)):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await do_health_check(db, provider)
    db.refresh(provider)

    return {
        "success": provider.last_check_success,
        "message": "连接成功" if provider.last_check_success else (provider.last_check_error or "连接失败"),
        "latency_ms": provider.last_check_latency_ms,
    }


@router.get("/{provider_id}/models")
async def list_provider_models(provider_id: int, db: Session = Depends(get_db)):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        if provider.type == "openai":
            models = await openai_service.list_models(provider.api_key, provider.base_url, provider.proxy_url)
        else:
            models = await anthropic_service.list_models(provider.api_key, provider.base_url, provider.proxy_url)
        return {"models": models}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
