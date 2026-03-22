# AI API 中转站

统一对外提供 OpenAI 兼容接口，后端按配置转发到不同上游供应商（OpenAI / Anthropic）。
附带管理后台：Token 使用量统计、供应商配置管理。

## 快速启动

### 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

后端启动后访问 API 文档：http://localhost:8000/docs

### 前端

```bash
cd frontend
npm install
npm run dev
# 浏览器访问 http://localhost:5173
```

## 功能

### 代理接口

| 接口 | 说明 |
|------|------|
| `POST /api/openai/responses` | OpenAI Responses 透传接口 |
| `POST /api/openai/chat/completions` | OpenAI Chat Completions 透传接口 |
| `POST /v1/messages` | Anthropic 原生接口 |

### 测试代理

```bash
# 调用 GPT 模型（需配置 OpenAI 供应商）
curl -X POST http://localhost:8000/api/openai/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-client-key" \
  -d '{"model":"gpt-4o","input":"Hello"}'

# 或使用 Chat Completions 结构
curl -X POST http://localhost:8000/api/openai/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-client-key" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'

# 调用 Claude 模型（需配置 Anthropic 供应商）
curl -X POST http://localhost:8000/api/anthropic/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-client-key" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Hello"}]}'
```

### 管理后台

- **Token 统计**：总量概览、趋势折线图（日/周/月）、按模型饼图、按 API Key 排行
- **供应商配置**：新增/编辑/删除供应商、启用/停用切换、连通性测试

## 技术栈

- **后端**：FastAPI + SQLAlchemy + SQLite + httpx
- **前端**：React + TypeScript + Vite + MUI + recharts + axios
