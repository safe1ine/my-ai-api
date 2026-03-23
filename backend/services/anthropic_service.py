"""Anthropic API 调用服务（支持流式和非流式）"""
import time
import httpx
from typing import AsyncIterator


ANTHROPIC_BASE_URL = "https://api.anthropic.com"
ANTHROPIC_VERSION = "2023-06-01"


def _build_url(base_url: str | None, path: str) -> str:
    base = (base_url or ANTHROPIC_BASE_URL).rstrip("/")
    if base.endswith("/v1"):
        return base + path.removeprefix("/v1")
    return base + path


def _build_headers(api_key: str) -> dict:
    return {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }


def _build_health_check_headers(api_key: str) -> dict:
    headers = _build_headers(api_key)
    # 该上游要求以 Claude CLI 的请求形态访问 beta 消息接口。
    headers["User-Agent"] = "claude-cli/2.1.81 (external, cli)"
    return headers


async def call_messages(
    api_key: str,
    base_url: str | None,
    payload: dict,
) -> tuple[dict, int, int, int]:
    """
    非流式调用 Anthropic Messages API
    返回 (response_json, input_tokens, output_tokens, latency_ms)
    """
    url = _build_url(base_url, "/v1/messages")
    payload = {**payload, "stream": False}

    start = time.monotonic()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=payload, headers=_build_headers(api_key))
        resp.raise_for_status()
        data = resp.json()

    latency_ms = int((time.monotonic() - start) * 1000)
    usage = data.get("usage", {})
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    return data, input_tokens, output_tokens, latency_ms


async def stream_messages(
    api_key: str,
    base_url: str | None,
    payload: dict,
) -> AsyncIterator[bytes]:
    """流式调用 Anthropic Messages API，yield SSE 字节块"""
    url = _build_url(base_url, "/v1/messages")
    payload = {**payload, "stream": True}

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=payload, headers=_build_headers(api_key)) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                yield chunk


async def openai_to_anthropic(payload: dict) -> dict:
    """
    将 OpenAI chat/completions 格式转换为 Anthropic messages 格式
    """
    messages = payload.get("messages", [])
    system_content = None
    converted = []

    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "system":
            system_content = content if isinstance(content, str) else str(content)
        elif role in ("user", "assistant"):
            converted.append({"role": role, "content": content})

    result: dict = {
        "model": payload.get("model", "claude-sonnet-4-6"),
        "messages": converted,
        "max_tokens": payload.get("max_tokens") or 1024,
    }
    if system_content:
        result["system"] = system_content
    if payload.get("temperature") is not None:
        result["temperature"] = payload["temperature"]
    return result


def anthropic_to_openai(data: dict, original_model: str) -> dict:
    """
    将 Anthropic messages 响应转换为 OpenAI chat/completions 格式
    """
    content_blocks = data.get("content", [])
    text = ""
    for block in content_blocks:
        if block.get("type") == "text":
            text += block.get("text", "")

    usage = data.get("usage", {})
    return {
        "id": data.get("id", ""),
        "object": "chat.completion",
        "model": original_model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": data.get("stop_reason", "stop"),
            }
        ],
        "usage": {
            "prompt_tokens": usage.get("input_tokens", 0),
            "completion_tokens": usage.get("output_tokens", 0),
            "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
        },
    }


async def list_models(api_key: str, base_url: str | None, proxy_url: str | None = None) -> list[str]:
    """返回该 Anthropic 上游支持的模型 ID 列表"""
    url = _build_url(base_url, "/v1/models")
    async with httpx.AsyncClient(timeout=15, proxy=proxy_url) as client:
        resp = await client.get(url, headers=_build_headers(api_key))
        resp.raise_for_status()
        data = resp.json()
    return sorted(m["id"] for m in data.get("data", []))


async def _check_stream_response(
    client: httpx.AsyncClient,
    url: str,
    headers: dict,
    payload: dict,
) -> tuple[bool, str | None]:
    async with client.stream("POST", url, json={**payload, "stream": True}, headers=headers) as resp:
        if resp.status_code != 200:
            body = await resp.aread()
            return False, f"HTTP {resp.status_code}: {body.decode('utf-8', errors='ignore')[:200]}"
        async for chunk in resp.aiter_bytes():
            if chunk.strip():
                return True, None
        return False, "流式响应为空"


async def test_connection(api_key: str, base_url: str | None, proxy_url: str | None = None) -> tuple[bool, str | None, int]:
    """测试 Anthropic API 连通性，先非流式探活，失败后回退流式"""
    url = _build_url(base_url, "/v1/messages?beta=true")
    payload = {
        "model": "claude-haiku-4-5-20251001",
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
    }
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=15, proxy=proxy_url) as client:
            headers = _build_health_check_headers(api_key)
            resp = await client.post(url, json=payload, headers=headers)
            latency_ms = int((time.monotonic() - start) * 1000)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("content"):
                    return True, None, latency_ms
                non_stream_error = "响应中没有 content 字段"
            else:
                non_stream_error = f"HTTP {resp.status_code}: {resp.text[:200]}"

            stream_ok, stream_error = await _check_stream_response(client, url, headers, payload)
            latency_ms = int((time.monotonic() - start) * 1000)
            if stream_ok:
                return True, None, latency_ms

            suffix = f"; stream={stream_error}" if stream_error else ""
            return False, f"{non_stream_error}{suffix}", latency_ms
    except Exception as e:
        latency_ms = int((time.monotonic() - start) * 1000)
        return False, str(e), latency_ms
