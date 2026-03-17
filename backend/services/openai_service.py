"""OpenAI API 调用服务（支持流式和非流式）"""
import time
import httpx
from typing import AsyncIterator


OPENAI_BASE_URL = "https://api.openai.com"


async def call_chat_completions(
    api_key: str,
    base_url: str | None,
    payload: dict,
) -> tuple[dict, int, int, int]:
    """
    非流式调用，返回 (response_json, input_tokens, output_tokens, latency_ms)
    """
    url = (base_url or OPENAI_BASE_URL).rstrip("/") + "/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {**payload, "stream": False}

    start = time.monotonic()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    latency_ms = int((time.monotonic() - start) * 1000)
    usage = data.get("usage", {})
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)
    return data, input_tokens, output_tokens, latency_ms


async def stream_chat_completions(
    api_key: str,
    base_url: str | None,
    payload: dict,
) -> AsyncIterator[bytes]:
    """
    流式调用，yield SSE 字节块
    """
    url = (base_url or OPENAI_BASE_URL).rstrip("/") + "/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {**payload, "stream": True}

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                yield chunk


async def list_models(api_key: str, base_url: str | None) -> list[str]:
    """返回该 OpenAI 上游支持的模型 ID 列表"""
    url = (base_url or OPENAI_BASE_URL).rstrip("/") + "/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    return sorted(m["id"] for m in data.get("data", []))


async def test_connection(api_key: str, base_url: str | None) -> bool:
    """测试 OpenAI API 连通性"""
    url = (base_url or OPENAI_BASE_URL).rstrip("/") + "/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            return resp.status_code == 200
    except Exception:
        return False
