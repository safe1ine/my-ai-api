"""
代理转发路由
- POST /api/openai/chat/completions  OpenAI 兼容接口
- POST /api/anthropic/messages      Anthropic 兼容接口
"""
import time
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from auth import verify_client_key
from database import get_db
from models import ApiLog, LogStatus, Provider, ProviderType
from schemas import ChatCompletionRequest, AnthropicMessageRequest
from services import openai_service, anthropic_service
from utils.sanitizer import extract_prompt_summary, extract_response_summary

router = APIRouter(tags=["proxy"], dependencies=[Depends(verify_client_key)])


def _get_key_prefix(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth:
        key = auth.removeprefix("Bearer ").strip()
    else:
        key = request.headers.get("x-api-key", "")
    return key[:12] + "****" if len(key) >= 12 else (key[:4] + "****" if key else "unknown")


def _get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


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
    request_summary: str | None = None,
    response_summary: str | None = None,
    error_message: str | None = None,
    client_ip: str | None = None,
    first_token_latency_ms: int = 0,
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
        request_summary=request_summary,
        response_summary=response_summary,
        error_message=error_message,
        client_ip=client_ip,
        first_token_latency_ms=first_token_latency_ms,
    )
    db.add(log)
    db.commit()


# ── OpenAI 兼容接口 ─────────────────────────────────────────────────────
@router.post("/api/openai/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key_prefix = _get_key_prefix(request)
    client_ip = _get_client_ip(request)
    model = body.model
    messages = body.messages
    system = getattr(body, "system", None)
    
    request_summary = extract_prompt_summary(messages, system) if messages or system else None
    provider = _pick_provider(db, ProviderType.openai)
    payload = body.model_dump(exclude_none=True)

    if body.stream:
        async def openai_stream():
            first_token_time = None
            start = time.monotonic()
            response_summary = None
            try:
                async for chunk in openai_service.stream_chat_completions(
                    provider.api_key, provider.base_url, payload
                ):
                    if first_token_time is None:
                        first_token_time = int((time.monotonic() - start) * 1000)
                    chunk_str = chunk.decode() if isinstance(chunk, bytes) else chunk
                    
                    for line in chunk_str.split("\n"):
                        if line.startswith("data: "):
                            try:
                                data = json.loads(line[6:])
                                if data.get("choices"):
                                    delta = data["choices"][0].get("delta", {})
                                    if delta.get("content"):
                                        text = delta["content"]
                                        if response_summary is None:
                                            response_summary = text[:300]
                                        else:
                                            response_summary += text[:300]
                            except:
                                pass
                    
                    yield chunk
            finally:
                total_time = int((time.monotonic() - start) * 1000)
                _log(
                    db, provider.id, model, key_prefix, 0, 0, LogStatus.success, total_time,
                    request_summary=request_summary,
                    response_summary=response_summary,
                    client_ip=client_ip,
                    first_token_latency_ms=first_token_time or 0,
                )

        return StreamingResponse(openai_stream(), media_type="text/event-stream")

    start = time.monotonic()
    try:
        result, in_tok, out_tok, latency = await openai_service.call_chat_completions(
            provider.api_key, provider.base_url, payload
        )

        response_content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        response_summary = extract_response_summary(response_content)

        _log(
            db, provider.id, model, key_prefix, in_tok, out_tok, LogStatus.success, latency,
            request_summary=request_summary,
            response_summary=response_summary,
            client_ip=client_ip,
        )
        return JSONResponse(content=result)

    except Exception as exc:
        latency = int((time.monotonic() - start) * 1000)
        _log(
            db, provider.id, model, key_prefix, 0, 0, LogStatus.error, latency,
            request_summary=request_summary,
            error_message=str(exc),
            client_ip=client_ip,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ── Anthropic 兼容接口 ──────────────────────────────────────────────────
@router.post("/api/anthropic/messages")
async def messages(
    body: AnthropicMessageRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    key_prefix = _get_key_prefix(request)
    client_ip = _get_client_ip(request)
    provider = _pick_provider(db, ProviderType.anthropic)
    payload = body.model_dump(exclude_none=True)

    system = getattr(body, "system", None)
    request_summary = extract_prompt_summary(body.messages, system) if body.messages or system else None

    if body.stream:
        start = time.monotonic()
        
        async def _stream():
            first_token_time = None
            input_tokens = 0
            output_tokens = 0
            response_summary = None
            try:
                async for chunk in anthropic_service.stream_messages(
                    provider.api_key, provider.base_url, payload
                ):
                    if first_token_time is None:
                        first_token_time = int((time.monotonic() - start) * 1000)
                    chunk_str = chunk.decode() if isinstance(chunk, bytes) else chunk
                    
                    for line in chunk_str.split("\n"):
                        if line.startswith("data: "):
                            try:
                                data = json.loads(line[6:])
                                if data.get("type") == "message_start":
                                    input_tokens = data.get("message", {}).get("usage", {}).get("input_tokens", 0)
                                elif data.get("type") == "message_delta":
                                    output_tokens = data.get("usage", {}).get("output_tokens", 0)
                                elif data.get("type") == "content_block_delta":
                                    delta = data.get("delta", {})
                                    if delta.get("type") == "text_delta":
                                        text = delta.get("text", "")
                                        if response_summary is None:
                                            response_summary = text[:300]
                                        else:
                                            response_summary += text[:300]
                            except:
                                pass
                    
                    yield chunk
            finally:
                total_time = int((time.monotonic() - start) * 1000)
                _log(
                    db, provider.id, body.model, key_prefix, input_tokens, output_tokens, LogStatus.success, total_time,
                    request_summary=request_summary,
                    response_summary=response_summary,
                    client_ip=client_ip,
                    first_token_latency_ms=first_token_time or 0,
                )

        return StreamingResponse(_stream(), media_type="text/event-stream")

    start = time.monotonic()
    try:
        data, in_tok, out_tok, latency = await anthropic_service.call_messages(
            provider.api_key, provider.base_url, payload
        )
        response_content = data.get("content", [])
        if isinstance(response_content, list):
            response_text = ""
            for block in response_content:
                if block.get("type") == "text":
                    response_text += block.get("text", "")
            response_summary = extract_response_summary(response_text)
        else:
            response_summary = None

        _log(
            db, provider.id, body.model, key_prefix, in_tok, out_tok, LogStatus.success, latency,
            request_summary=request_summary,
            response_summary=response_summary,
            client_ip=client_ip,
        )
        return JSONResponse(content=data)
    except Exception as exc:
        latency = int((time.monotonic() - start) * 1000)
        _log(
            db, provider.id, body.model, key_prefix, 0, 0, LogStatus.error, latency,
            request_summary=request_summary,
            error_message=str(exc),
            client_ip=client_ip,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc
