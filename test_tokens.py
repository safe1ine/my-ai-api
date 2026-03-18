#!/usr/bin/env python3
"""测试 Anthropic API Token 可用性"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

BASE_URL = "https://api.mulerun.com"
ANTHROPIC_VERSION = "2023-06-01"
TOKEN_FILE = "/workspace/token1.txt"
OUTPUT_FILE = "/workspace/token_test_results.json"


def build_headers(api_key: str) -> dict:
    return {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }


async def test_token(session: aiohttp.ClientSession, token: str) -> dict:
    """测试单个 token 的可用性"""
    url = f"{BASE_URL}/v1/messages"
    headers = build_headers(token)
    payload = {
        "model": "claude-haiku-4-5-20251001",
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
    }
    
    start_time = time.monotonic()
    try:
        async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            
            if resp.status == 200:
                return {
                    "token": token,
                    "available": True,
                    "error": None,
                    "latency_ms": latency_ms,
                    "status_code": resp.status
                }
            else:
                text = await resp.text()
                return {
                    "token": token,
                    "available": False,
                    "error": f"HTTP {resp.status}: {text[:200]}",
                    "latency_ms": latency_ms,
                    "status_code": resp.status
                }
    except asyncio.TimeoutError:
        return {
            "token": token,
            "available": False,
            "error": "请求超时",
            "latency_ms": None,
            "status_code": None
        }
    except aiohttp.ClientError as e:
        return {
            "token": token,
            "available": False,
            "error": f"网络错误: {str(e)}",
            "latency_ms": None,
            "status_code": None
        }
    except Exception as e:
        return {
            "token": token,
            "available": False,
            "error": f"未知错误: {str(e)}",
            "latency_ms": None,
            "status_code": None
        }


async def main():
    with open(TOKEN_FILE, "r") as f:
        tokens = [line.strip() for line in f if line.strip()]
    
    print(f"共 {len(tokens)} 个 Token 待测试...")
    
    results = []
    available_tokens = []
    unavailable_tokens = []
    
    connector = aiohttp.TCPConnector(limit=10)
    async with aiohttp.ClientSession(connector=connector) as session:
        for i, token in enumerate(tokens, 1):
            print(f"[{i}/{len(tokens)}] 测试: {token[:15]}...", end=" ")
            result = await test_token(session, token)
            results.append(result)
            
            if result["available"]:
                available_tokens.append(result)
                print(f"✓ 可用 (延迟: {result['latency_ms']}ms)")
            else:
                unavailable_tokens.append(result)
                print(f"✗ 不可用: {result['error']}")
            
            await asyncio.sleep(0.1)
    
    output = {
        "test_time": datetime.now().isoformat(),
        "total": len(tokens),
        "available": len(available_tokens),
        "unavailable": len(unavailable_tokens),
        "available_tokens": available_tokens,
        "unavailable_tokens": unavailable_tokens
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*50}")
    print(f"测试完成!")
    print(f"总计: {len(tokens)}")
    print(f"可用: {len(available_tokens)}")
    print(f"不可用: {len(unavailable_tokens)}")
    print(f"结果已保存到: {OUTPUT_FILE}")
    
    if unavailable_tokens:
        print(f"\n不可用原因统计:")
        error_counts = {}
        for r in unavailable_tokens:
            err = r["error"] or "未知错误"
            if "HTTP 401" in err:
                err = "HTTP 401: 认证失败"
            elif "HTTP 403" in err:
                err = "HTTP 403: 禁止访问"
            elif "HTTP 404" in err:
                err = "HTTP 404: 资源不存在"
            elif "HTTP 429" in err:
                err = "HTTP 429: 请求过多"
            error_counts[err] = error_counts.get(err, 0) + 1
        
        for err, count in sorted(error_counts.items(), key=lambda x: -x[1]):
            print(f"  - {err}: {count} 个")


if __name__ == "__main__":
    asyncio.run(main())
