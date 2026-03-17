"""Anthropic API 调用服务（支持流式和非流式）"""
import time
import httpx
from typing import AsyncIterator


ANTHROPIC_BASE_URL = "https://api.anthropic.com"
ANTHROPIC_VERSION = "2023-06-01"


def _build_headers(api_key: str) -> dict:
    return {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }


async def call_messages(
    api_key: str,
    base_url: str | None,
    payload: dict,
) -> tuple[dict, int, int, int]:
    """
    非流式调用 Anthropic Messages API
    返回 (response_json, input_tokens, output_tokens, latency_ms)
    """
    url = (base_url or ANTHROPIC_BASE_URL).rstrip("/") + "/v1/messages"
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
    url = (base_url or ANTHROPIC_BASE_URL).rstrip("/") + "/v1/messages"
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


async def list_models(api_key: str, base_url: str | None) -> list[str]:
    """返回该 Anthropic 上游支持的模型 ID 列表"""
    url = (base_url or ANTHROPIC_BASE_URL).rstrip("/") + "/v1/models"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=_build_headers(api_key))
        resp.raise_for_status()
        data = resp.json()
    return sorted(m["id"] for m in data.get("data", []))


async def test_connection(api_key: str, base_url: str | None) -> bool:
    """测试 Anthropic API 连通性（发一个极小请求）"""
    url = (base_url or ANTHROPIC_BASE_URL).rstrip("/") + "/v1/messages"
    payload = {
        "model": "claude-haiku-4-5-20251001",
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=_build_headers(api_key))
            return resp.status_code in (200, 400, 401, 429)  # 非网络层错误即视为可达
    except Exception:
        return False
