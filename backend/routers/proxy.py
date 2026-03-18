"""
透传代理路由
- ANY /api/openai/{path:path}    → 上游 OpenAI base_url + /v1/{path}
- ANY /api/anthropic/{path:path} → 上游 Anthropic base_url + /v1/{path}

只有以下路径写入 api_logs：
  openai:    chat/completions
  anthropic: messages
"""
import json
import logging
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

logger = logging.getLogger("proxy")
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session

from auth import verify_client_key
from database import get_db
from models import ApiLog, LogStatus, Provider, ProviderType
from services.openai_service import OPENAI_BASE_URL
from services.anthropic_service import ANTHROPIC_BASE_URL, ANTHROPIC_VERSION
from utils.sanitizer import extract_prompt_summary, extract_response_summary

router = APIRouter(tags=["proxy"], dependencies=[Depends(verify_client_key)])

# 客户端 → 上游时跳过的请求头（鉴权由我们替换，hop-by-hop 不转发）
_SKIP_REQ = frozenset({"authorization", "x-api-key", "host", "content-length",
                       "transfer-encoding", "connection"})

# 上游 → 客户端时跳过的响应头
_SKIP_RESP = frozenset({"transfer-encoding", "connection", "keep-alive",
                        "content-encoding", "content-length"})

# 仅这些路径记录到日志表
_LOG_PATHS = {
    "openai": {"chat/completions"},
    "anthropic": {"messages"},
}


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)


def _pick_providers(db: Session, ptype: ProviderType) -> list[Provider]:
    """返回按 健康优先→优先级→延迟 排序的上游列表（数字越小优先级越高）"""
    candidates = (
        db.query(Provider)
        .filter(Provider.type == ptype, Provider.is_active == True)  # noqa: E712
        .all()
    )
    if not candidates:
        raise HTTPException(status_code=503, detail=f"没有可用的 {ptype} 上游，请先配置并启用")

    healthy = sorted(
        [p for p in candidates if p.last_check_success is True],
        key=lambda p: (p.priority if p.priority is not None else 5, p.last_check_latency_ms or 999999),
    )
    others = sorted(
        [p for p in candidates if p.last_check_success is not True],
        key=lambda p: (p.priority if p.priority is not None else 5, p.last_check_latency_ms or 999999),
    )
    return healthy + others


def _upstream_url(vendor: str, provider: Provider, path: str) -> str:
    """把客户端路径映射到上游 URL，自动补 /v1/ 前缀（避免双重 v1）"""
    base = ((provider.base_url or OPENAI_BASE_URL) if vendor == "openai"
            else (provider.base_url or ANTHROPIC_BASE_URL)).rstrip("/")
    clean = path.lstrip("/")
    # 如果客户端已带 v1/（如 Anthropic SDK 默认行为），不再重复
    if clean.startswith("v1/") or clean == "v1":
        return f"{base}/{clean}"
    return f"{base}/v1/{clean}"


def _upstream_headers(vendor: str, provider: Provider, req_headers: dict) -> dict:
    """转发客户端头，替换鉴权为上游 key"""
    headers = {k: v for k, v in req_headers.items() if k.lower() not in _SKIP_REQ}
    if vendor == "openai":
        headers["Authorization"] = f"Bearer {provider.api_key}"
    else:
        headers["x-api-key"] = provider.api_key
        headers.setdefault("anthropic-version", ANTHROPIC_VERSION)
    return headers


def _normalize_path(path: str) -> str:
    """去除可能的 v1/ 前缀，得到裸路径用于日志判断"""
    p = path.lstrip("/")
    return p[3:] if p.startswith("v1/") else p


def _should_log(vendor: str, path: str) -> bool:
    return _normalize_path(path) in _LOG_PATHS.get(vendor, set())


def _write_log(db: Session, is_stream: bool = False, **kwargs):
    db.add(ApiLog(is_stream=is_stream, **kwargs))
    db.commit()


# ── 通用日志解析 ────────────────────────────────────────────────────────────

def _parse_openai_stream_log(chunks: list[bytes]) -> dict:
    """从 OpenAI SSE 块中提取 token 数和响应摘要"""
    text = b"".join(chunks).decode("utf-8", errors="replace")
    input_tokens = output_tokens = cache_read = cache_write = 0
    response_parts: list[str] = []
    for line in text.splitlines():
        if not line.startswith("data: "):
            continue
        raw = line[6:]
        if raw.strip() == "[DONE]":
            continue
        try:
            d = json.loads(raw)
            if d.get("usage"):
                u = d["usage"]
                input_tokens = u.get("prompt_tokens", 0)
                output_tokens = u.get("completion_tokens", 0)
                details = u.get("prompt_tokens_details") or {}
                cache_read = details.get("cached_tokens", 0)
            for choice in d.get("choices", []):
                content = choice.get("delta", {}).get("content") or ""
                if content:
                    response_parts.append(content)
        except Exception:
            pass
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read_tokens": cache_read,
        "cache_write_tokens": cache_write,
        "response_summary": extract_response_summary("".join(response_parts)) if response_parts else None,
    }


def _parse_anthropic_stream_log(chunks: list[bytes]) -> dict:
    """从 Anthropic SSE 块中提取 token 数和响应摘要"""
    text = b"".join(chunks).decode("utf-8", errors="replace")
    input_tokens = output_tokens = cache_read = cache_write = 0
    response_parts: list[str] = []
    thinking_parts: list[str] = []
    for line in text.splitlines():
        if not line.startswith("data: "):
            continue
        try:
            d = json.loads(line[6:])
            t = d.get("type")
            if t == "message_start":
                u = d.get("message", {}).get("usage", {})
                input_tokens = u.get("input_tokens", 0)
                cache_read = u.get("cache_read_input_tokens", 0)
                cache_write = u.get("cache_creation_input_tokens", 0)
            elif t == "message_delta":
                output_tokens = d.get("usage", {}).get("output_tokens", 0)
            elif t == "content_block_delta":
                delta = d.get("delta", {})
                delta_type = delta.get("type")
                if delta_type == "text_delta":
                    c = delta.get("text", "")
                    if c:
                        response_parts.append(c)
                elif delta_type == "thinking_delta":
                    c = delta.get("thinking", "")
                    if c:
                        thinking_parts.append(c)
        except Exception as e:
            logger.warning("[parse] failed to parse line: %s, error: %s", line[:100], e)
    # 优先使用文本响应，如果没有则使用 thinking 内容
    content = "".join(response_parts) or "".join(thinking_parts)
    logger.warning("[parse] response_parts=%d thinking_parts=%d content_len=%d", 
                   len(response_parts), len(thinking_parts), len(content))
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read_tokens": cache_read,
        "cache_write_tokens": cache_write,
        "response_summary": extract_response_summary(content) if content else None,
        "has_thinking": len(thinking_parts) > 0,
    }


# ── Anthropic 自动注入 cache_control ────────────────────────────────────────

def _has_cache_control(req: dict) -> bool:
    """检查请求里是否已经有任何 cache_control 标记"""
    sys = req.get("system")
    if isinstance(sys, list):
        if any(isinstance(b, dict) and "cache_control" in b for b in sys):
            logger.debug("[cache] found cache_control in system blocks")
            return True
    for i, msg in enumerate(req.get("messages", [])):
        content = msg.get("content")
        if isinstance(content, list):
            if any(isinstance(b, dict) and "cache_control" in b for b in content):
                logger.debug("[cache] found cache_control in messages[%d] (role=%s)", i, msg.get("role"))
                return True
    return False


def _inject_anthropic_cache(req: dict) -> dict:
    """
    为 Anthropic 请求自动加 cache_control，减少重复 token 费用。
    策略：
      1. system prompt → 整体标记为 ephemeral
      2. 若消息数 >= 2，对倒数第二条消息的最后一个 content block 打标记
         （即缓存除最新一轮外的所有历史）
    若请求已有 cache_control（如 Claude CLI 自管理缓存），直接原样返回。
    """
    if _has_cache_control(req):
        logger.info("[cache] request already has cache_control, skipping injection")
        return req
    import copy
    req = copy.deepcopy(req)

    # 1. system
    sys = req.get("system")
    if isinstance(sys, str) and sys:
        req["system"] = [{"type": "text", "text": sys,
                           "cache_control": {"type": "ephemeral"}}]
    elif isinstance(sys, list) and sys:
        last_block = sys[-1]
        if isinstance(last_block, dict) and "cache_control" not in last_block:
            last_block["cache_control"] = {"type": "ephemeral"}

    # 2. 历史消息（倒数第二条）
    msgs = req.get("messages", [])
    if len(msgs) >= 2:
        target = msgs[-2]
        content = target.get("content")
        if isinstance(content, str) and content:
            target["content"] = [{"type": "text", "text": content,
                                   "cache_control": {"type": "ephemeral"}}]
        elif isinstance(content, list) and content:
            last_block = content[-1]
            if isinstance(last_block, dict) and "cache_control" not in last_block:
                last_block["cache_control"] = {"type": "ephemeral"}

    return req


# ── 核心代理逻辑 ────────────────────────────────────────────────────────────

async def _proxy(request: Request, vendor: str, path: str,
                 db: Session, client_key):
    ptype = ProviderType.openai if vendor == "openai" else ProviderType.anthropic
    provider_list = _pick_providers(db, ptype)

    body = await request.body()
    params = dict(request.query_params)
    do_log = _should_log(vendor, path)
    client_ip = _client_ip(request)
    
    logger.warning("[proxy] vendor=%s path=%s normalized_path=%s do_log=%s", 
                   vendor, path, _normalize_path(path), do_log)

    # 解析请求摘要（仅日志路径，只做一次）
    req_body_json: dict = {}
    system_prompt = request_summary = None
    if do_log and body:
        try:
            req_body_json = json.loads(body)
            msgs = req_body_json.get("messages", [])
            sys = req_body_json.get("system")
            system_prompt, request_summary = extract_prompt_summary(msgs, sys) if (msgs or sys) else (None, None)
        except Exception:
            pass

    is_stream = bool(req_body_json.get("stream"))

    if do_log and req_body_json:
        msgs = req_body_json.get("messages", [])
        sys = req_body_json.get("system")
        logger.info("[req] vendor=%s model=%s stream=%s msgs=%d sys_type=%s",
                    vendor, req_body_json.get("model", "?"), is_stream, len(msgs),
                    type(sys).__name__ if sys is not None else "None")
        for i, m in enumerate(msgs):
            c = m.get("content")
            if isinstance(c, list):
                block_types = [b.get("type") for b in c if isinstance(b, dict)]
                has_cc = any("cache_control" in b for b in c if isinstance(b, dict))
                logger.info("[req] messages[%d] role=%s blocks=%s has_cache_control=%s",
                            i, m.get("role"), block_types, has_cc)
            else:
                logger.info("[req] messages[%d] role=%s content_type=str", i, m.get("role"))

    # OpenAI 流式：注入 stream_options 使最后一个 chunk 带 usage
    if is_stream and vendor == "openai" and do_log:
        try:
            patched = json.loads(body)
            patched.setdefault("stream_options", {})["include_usage"] = True
            body = json.dumps(patched).encode()
        except Exception:
            pass

    # Anthropic：自动注入 cache_control
    if vendor == "anthropic" and _normalize_path(path) == "messages":
        try:
            body = json.dumps(_inject_anthropic_cache(json.loads(body))).encode()
        except Exception:
            pass

    # ── 重试循环 ────────────────────────────────────────────────────────────
    last_error: str | None = None
    last_error_content: bytes = b""
    last_error_status: int = 502
    last_error_resp_headers: dict = {}

    for attempt, provider in enumerate(provider_list):
        url = _upstream_url(vendor, provider, path)
        up_headers = _upstream_headers(vendor, provider, dict(request.headers))
        start = time.monotonic()

        try:
            if is_stream:
                # 流式：先建连接检查状态码，再决定是否 yield
                http_client = httpx.AsyncClient(timeout=180, proxy=provider.proxy_url or None)
                resp = await http_client.send(
                    http_client.build_request(
                        method=request.method,
                        url=url,
                        headers=up_headers,
                        content=body,
                        params=params,
                    ),
                    stream=True,
                )

                if resp.status_code != 200:
                    error_content = await resp.aread()
                    await resp.aclose()
                    await http_client.aclose()
                    last_error = f"HTTP {resp.status_code}"
                    last_error_content = error_content
                    last_error_status = resp.status_code
                    last_error_resp_headers = {k: v for k, v in resp.headers.items()
                                               if k.lower() not in _SKIP_RESP}
                    logger.warning("[proxy] provider=%s stream status=%d, trying next (attempt %d/%d)",
                                   provider.name, resp.status_code, attempt + 1, len(provider_list))
                    continue

                # 状态 200，开始流式转发（此后不再重试）
                resp_headers = {k: v for k, v in resp.headers.items()
                                if k.lower() not in _SKIP_RESP}
                first_token_time: int | None = None
                collected: list[bytes] = []

                async def _stream_gen():
                    nonlocal first_token_time
                    try:
                        async for chunk in resp.aiter_bytes():
                            if first_token_time is None and chunk:
                                first_token_time = int((time.monotonic() - start) * 1000)
                            if do_log:
                                collected.append(chunk)
                                logger.debug("[stream] collected chunk: %d bytes", len(chunk))
                            yield chunk
                    finally:
                        await resp.aclose()
                        await http_client.aclose()
                        if do_log:
                            logger.warning("[stream] collected %d chunks, total %d bytes", len(collected), sum(len(c) for c in collected))
                            total_ms = int((time.monotonic() - start) * 1000)
                            parser = (_parse_openai_stream_log if vendor == "openai"
                                      else _parse_anthropic_stream_log)
                            parsed = parser(collected)
                            logger.info("[stream] parsed: input=%d output=%d cache_read=%d cache_write=%d has_summary=%s summary_len=%d has_thinking=%s",
                                        parsed["input_tokens"], parsed["output_tokens"],
                                        parsed["cache_read_tokens"], parsed["cache_write_tokens"],
                                        bool(parsed["response_summary"]), len(parsed["response_summary"] or ""), parsed.get("has_thinking", False))
                            # 成功条件：有输出 token、有响应摘要、或有 thinking 内容
                            has_content = parsed["output_tokens"] > 0 or parsed["response_summary"] or parsed.get("has_thinking", False)
                            stream_status = LogStatus.success if has_content else LogStatus.error
                            logger.warning("[stream] FINAL STATUS=%s has_content=%s output_tokens=%d has_summary=%s has_thinking=%s", 
                                         stream_status, has_content, parsed["output_tokens"], 
                                         bool(parsed["response_summary"]), parsed.get("has_thinking", False))
                            stream_error = None
                            if stream_status == LogStatus.error:
                                stream_error = b"".join(collected)[:1024].decode("utf-8", errors="replace")
                            _write_log(db,
                                is_stream=True,
                                provider_id=provider.id,
                                client_key_id=client_key.id,
                                model=req_body_json.get("model", ""),
                                key_name=client_key.name,
                                input_tokens=parsed["input_tokens"],
                                output_tokens=parsed["output_tokens"],
                                total_tokens=parsed["input_tokens"] + parsed["output_tokens"] + parsed["cache_read_tokens"] + parsed["cache_write_tokens"],
                                cache_read_tokens=parsed["cache_read_tokens"],
                                cache_write_tokens=parsed["cache_write_tokens"],
                                status=stream_status,
                                latency_ms=total_ms,
                                first_token_latency_ms=first_token_time or 0,
                                system_prompt=system_prompt,
                                request_summary=request_summary,
                                response_summary=parsed["response_summary"],
                                error_message=stream_error,
                                client_ip=client_ip,
                            )

                return StreamingResponse(_stream_gen(), status_code=resp.status_code,
                                         headers=resp_headers,
                                         media_type=resp.headers.get("content-type"))

            else:
                # 非流式
                async with httpx.AsyncClient(timeout=180, proxy=provider.proxy_url or None) as client:
                    resp = await client.request(
                        method=request.method,
                        url=url,
                        headers=up_headers,
                        content=body,
                        params=params,
                    )
                resp_headers = {k: v for k, v in resp.headers.items()
                                if k.lower() not in _SKIP_RESP}
                latency_ms = int((time.monotonic() - start) * 1000)

                if resp.status_code >= 400:
                    last_error = f"HTTP {resp.status_code}"
                    last_error_content = resp.content
                    last_error_status = resp.status_code
                    last_error_resp_headers = resp_headers
                    logger.warning("[proxy] provider=%s non-stream status=%d, trying next (attempt %d/%d)",
                                   provider.name, resp.status_code, attempt + 1, len(provider_list))
                    continue

                # 成功：记录日志并返回
                if do_log:
                    in_tok = out_tok = cache_read = cache_write = 0
                    response_summary = None
                    error_msg = None
                    status = LogStatus.error
                    try:
                        rj = resp.json()
                        if vendor == "openai":
                            usage = rj.get("usage", {})
                            in_tok = usage.get("prompt_tokens", 0)
                            out_tok = usage.get("completion_tokens", 0)
                            details = usage.get("prompt_tokens_details") or {}
                            cache_read = details.get("cached_tokens", 0)
                            content = rj.get("choices", [{}])[0].get("message", {}).get("content", "")
                            response_summary = extract_response_summary(content)
                            status = LogStatus.success if resp.status_code == 200 and bool(rj.get("choices")) else LogStatus.error
                        else:
                            usage = rj.get("usage", {})
                            in_tok = usage.get("input_tokens", 0)
                            out_tok = usage.get("output_tokens", 0)
                            cache_read = usage.get("cache_read_input_tokens", 0)
                            cache_write = usage.get("cache_creation_input_tokens", 0)
                            blocks = rj.get("content", [])
                            text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
                            response_summary = extract_response_summary(text)
                            status = LogStatus.success if resp.status_code == 200 and bool(rj.get("content")) else LogStatus.error
                        if status == LogStatus.error:
                            error_msg = resp.content[:1024].decode("utf-8", errors="replace")
                    except Exception:
                        error_msg = resp.content[:1024].decode("utf-8", errors="replace") if resp.content else f"HTTP {resp.status_code}"
                    _write_log(db,
                        provider_id=provider.id,
                        client_key_id=client_key.id,
                        model=req_body_json.get("model", ""),
                        key_name=client_key.name,
                        input_tokens=in_tok,
                        output_tokens=out_tok,
                        total_tokens=in_tok + out_tok + cache_read + cache_write,
                        cache_read_tokens=cache_read,
                        cache_write_tokens=cache_write,
                        status=status,
                        latency_ms=latency_ms,
                        first_token_latency_ms=0,
                        system_prompt=system_prompt,
                        request_summary=request_summary,
                        response_summary=response_summary,
                        error_message=error_msg,
                        client_ip=client_ip,
                    )

                return Response(
                    content=resp.content,
                    status_code=resp.status_code,
                    headers=resp_headers,
                    media_type=resp.headers.get("content-type"),
                )

        except HTTPException:
            raise
        except Exception as exc:
            last_error = str(exc)[:1024]
            logger.warning("[proxy] provider=%s exception: %s, trying next (attempt %d/%d)",
                           provider.name, exc, attempt + 1, len(provider_list))
            continue

    # 所有上游均失败，记录日志并返回最后一个失败的响应
    if do_log:
        _write_log(db,
            provider_id=provider_list[-1].id,
            client_key_id=client_key.id,
            model=req_body_json.get("model", ""),
            key_name=client_key.name,
            input_tokens=0, output_tokens=0, total_tokens=0,
            status=LogStatus.error,
            latency_ms=0,
            first_token_latency_ms=0,
            system_prompt=system_prompt,
            request_summary=request_summary,
            error_message=last_error or "所有上游均不可用",
            client_ip=client_ip,
        )

    if last_error_content:
        return Response(
            content=last_error_content,
            status_code=last_error_status,
            headers=last_error_resp_headers,
            media_type="application/json",
        )
    raise HTTPException(status_code=502, detail=last_error or "所有上游均不可用")


# ── 路由注册 ────────────────────────────────────────────────────────────────

METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]


@router.api_route("/api/openai/{path:path}", methods=METHODS)
async def proxy_openai(path: str, request: Request,
                       db: Session = Depends(get_db),
                       client_key=Depends(verify_client_key)):
    return await _proxy(request, "openai", path, db, client_key)


@router.api_route("/api/anthropic/{path:path}", methods=METHODS)
async def proxy_anthropic(path: str, request: Request,
                          db: Session = Depends(get_db),
                          client_key=Depends(verify_client_key)):
    return await _proxy(request, "anthropic", path, db, client_key)
