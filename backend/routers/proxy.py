"""
代理转发路由
- POST /v1/chat/completions  OpenAI 兼容接口
- POST /v1/messages          Anthropic 兼容接口
"""
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from auth import verify_client_key
from database import get_db
from models import ApiLog, LogStatus, Provider, ProviderType
from schemas import ChatCompletionRequest, AnthropicMessageRequest
from services import openai_service, anthropic_service

router = APIRouter(tags=["proxy"], dependencies=[Depends(verify_client_key)])


def _get_key_prefix(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    key = auth.removeprefix("Bearer ").strip()
    return key[:12] + "****" if len(key) >= 12 else (key[:4] + "****" if key else "unknown")


def _pick_provider(db: Session, provider_type: ProviderType) -> Provider:
    provider = (
        db.query(Provider)
        .filter(Provider.type == provider_type, Provider.is_active == True)  # noqa: E712
        .first()
    )
    if not provider:
        raise HTTPException(
            status_code=503,
            detail=f"没有可用的 {provider_type} 供应商，请先在管理页面配置并启用",
        )
    return provider


def _log(
    db: Session,
    provider_id: int | None,
    model: str,
    api_key_prefix: str,
    input_tokens: int,
    output_tokens: int,
    status: LogStatus,
    latency_ms: int,
):
    log = ApiLog(
        provider_id=provider_id,
        model=model,
        api_key_prefix=api_key_prefix,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        status=status,
        latency_ms=latency_ms,
    )
    db.add(log)
    db.commit()


# ── OpenAI 兼容接口 ─────────────────────────────────────────────────────
@router.post("/v1/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key_prefix = _get_key_prefix(request)
    model = body.model

    # 根据模型名判断使用哪种供应商
    is_anthropic_model = model.startswith("claude")
    provider_type = ProviderType.anthropic if is_anthropic_model else ProviderType.openai
    provider = _pick_provider(db, provider_type)

    payload = body.model_dump(exclude_none=True)

    if body.stream:
        # 流式响应
        if is_anthropic_model:
            anthropic_payload = await anthropic_service.openai_to_anthropic(payload)

            async def anthropic_stream():
                async for chunk in anthropic_service.stream_messages(
                    provider.api_key, provider.base_url, anthropic_payload
                ):
                    yield chunk

            return StreamingResponse(anthropic_stream(), media_type="text/event-stream")
        else:
            async def openai_stream():
                async for chunk in openai_service.stream_chat_completions(
                    provider.api_key, provider.base_url, payload
                ):
                    yield chunk

            return StreamingResponse(openai_stream(), media_type="text/event-stream")

    # 非流式
    start = time.monotonic()
    try:
        if is_anthropic_model:
            anthropic_payload = await anthropic_service.openai_to_anthropic(payload)
            data, in_tok, out_tok, latency = await anthropic_service.call_messages(
                provider.api_key, provider.base_url, anthropic_payload
            )
            result = anthropic_service.anthropic_to_openai(data, model)
        else:
            result, in_tok, out_tok, latency = await openai_service.call_chat_completions(
                provider.api_key, provider.base_url, payload
            )

        _log(db, provider.id, model, key_prefix, in_tok, out_tok, LogStatus.success, latency)
        return JSONResponse(content=result)

    except Exception as exc:
        latency = int((time.monotonic() - start) * 1000)
        _log(db, provider.id, model, key_prefix, 0, 0, LogStatus.error, latency)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ── Anthropic 兼容接口 ──────────────────────────────────────────────────
@router.post("/v1/messages")
async def messages(
    body: AnthropicMessageRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key_prefix = _get_key_prefix(request)
    provider = _pick_provider(db, ProviderType.anthropic)
    payload = body.model_dump(exclude_none=True)

    if body.stream:
        async def _stream():
            async for chunk in anthropic_service.stream_messages(
                provider.api_key, provider.base_url, payload
            ):
                yield chunk

        return StreamingResponse(_stream(), media_type="text/event-stream")

    start = time.monotonic()
    try:
        data, in_tok, out_tok, latency = await anthropic_service.call_messages(
            provider.api_key, provider.base_url, payload
        )
        _log(db, provider.id, body.model, key_prefix, in_tok, out_tok, LogStatus.success, latency)
        return JSONResponse(content=data)
    except Exception as exc:
        latency = int((time.monotonic() - start) * 1000)
        _log(db, provider.id, body.model, key_prefix, 0, 0, LogStatus.error, latency)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
