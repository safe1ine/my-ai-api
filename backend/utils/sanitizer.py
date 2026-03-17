def extract_prompt_summary(messages: list, system: str | None = None) -> str | None:
    parts = []
    if system:
        parts.append(f"system: {system[:100]}")
    if not messages:
        return " | ".join(parts)[:500] if parts else None
    
    for msg in messages:
        # 处理 Pydantic 模型对象或 dict
        if hasattr(msg, 'model_dump'):
            msg_dict = msg.model_dump()
        elif hasattr(msg, 'dict'):
            msg_dict = msg.dict()
        elif isinstance(msg, dict):
            msg_dict = msg
        else:
            continue
        
        content = msg_dict.get("content", "")
        role = msg_dict.get("role", "user")
        
        if content:
            if isinstance(content, str):
                text = content[:200]
            elif isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_parts.append(item.get("text", "")[:100])
                text = " ".join(text_parts)[:200]
            else:
                text = str(content)[:200]
            parts.append(f"{role}: {text}")
    
    result = " | ".join(parts)
    return result[:500] if result else None


def extract_response_summary(content: str | None) -> str | None:
    if not content:
        return None
    if isinstance(content, str):
        text = content[:300]
        if len(content) > 300:
            text += "..."
        return text
    return str(content)[:300]
