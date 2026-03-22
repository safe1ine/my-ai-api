"""OpenAI API 调用服务（默认使用 Responses API）"""
import time
import httpx
from typing import AsyncIterator


OPENAI_BASE_URL = "https://api.openai.com"
OPENAI_RESPONSES_PATH = "/v1/responses"
OPENAI_CHAT_PATH = "/v1/chat/completions"


def _build_url(base_url: str | None, path: str) -> str:
    base = (base_url or OPENAI_BASE_URL).rstrip("/")
    if base.endswith("/v1"):
        return base + path.removeprefix("/v1")
    return base + path


async def call_responses(
    api_key: str,
    base_url: str | None,
    payload: dict,
) -> tuple[dict, int, int, int]:
    """
    非流式调用，返回 (response_json, input_tokens, output_tokens, latency_ms)
    """
    url = _build_url(base_url, OPENAI_RESPONSES_PATH)
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
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    return data, input_tokens, output_tokens, latency_ms


async def stream_responses(
    api_key: str,
    base_url: str | None,
    payload: dict,
) -> AsyncIterator[bytes]:
    """
    流式调用，yield SSE 字节块
    """
    url = _build_url(base_url, OPENAI_RESPONSES_PATH)
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


async def list_models(api_key: str, base_url: str | None, proxy_url: str | None = None) -> list[str]:
    """返回该 OpenAI 上游支持的模型 ID 列表"""
    url = _build_url(base_url, "/v1/models")
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=15, proxy=proxy_url) as client:
        resp = await client.get(url, headers=headers)
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
    """测试 OpenAI API 连通性，先流式探活，失败后回退非流式"""
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    checks = [
        (
            "responses",
            _build_url(base_url, OPENAI_RESPONSES_PATH),
            {"model": "gpt-4o-mini", "input": "hi", "max_output_tokens": 1},
            "output",
        ),
        (
            "chat/completions",
            _build_url(base_url, OPENAI_CHAT_PATH),
            {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1},
            "choices",
        ),
    ]

    last_error = None
    last_latency_ms = 0
    async with httpx.AsyncClient(timeout=15, proxy=proxy_url) as client:
        for route_name, url, payload, success_field in checks:
            start = time.monotonic()
            try:
                stream_ok, stream_error = await _check_stream_response(client, url, headers, payload)
                latency_ms = int((time.monotonic() - start) * 1000)
                last_latency_ms = latency_ms
                if stream_ok:
                    return True, None, latency_ms
                resp = await client.post(url, json=payload, headers=headers)
                latency_ms = int((time.monotonic() - start) * 1000)
                last_latency_ms = latency_ms
                if resp.status_code != 200:
                    suffix = f"; stream={stream_error}" if stream_error else ""
                    last_error = f"{route_name}: HTTP {resp.status_code}: {resp.text[:200]}{suffix}"
                    continue
                data = resp.json()
                if not data.get(success_field):
                    suffix = f"; stream={stream_error}" if stream_error else ""
                    last_error = f"{route_name}: 响应中没有 {success_field} 字段{suffix}"
                    continue
                return True, None, latency_ms
            except Exception as e:
                last_latency_ms = int((time.monotonic() - start) * 1000)
                last_error = f"{route_name}: {e}"
                continue
    return False, last_error, last_latency_ms
