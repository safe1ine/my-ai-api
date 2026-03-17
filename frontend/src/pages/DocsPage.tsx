import { useState } from 'react'

const BASE_URL = window.location.origin

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="position-relative mb-3">
      <pre
        className="rounded p-3 mb-0"
        style={{ background: '#1e2030', color: '#cdd6f4', fontSize: 13, overflowX: 'auto' }}
      >
        <code>{code}</code>
      </pre>
      <button
        className={`btn btn-sm position-absolute top-0 end-0 m-2 ${copied ? 'btn-success' : 'btn-outline-secondary'}`}
        style={{ fontSize: 12 }}
        onClick={handleCopy}
      >
        <i className={`bi ${copied ? 'bi-check' : 'bi-clipboard'} me-1`} />
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}

export default function DocsPage() {
  const openaiCurl = `curl ${BASE_URL}/api/openai/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "你好"}]
  }}'`

  const anthropicCurl = `curl ${BASE_URL}/api/anthropic/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-opus-4-6",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}]
  }'`

  const anthropicCurlWithXApiKey = `curl ${BASE_URL}/api/anthropic/messages \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-opus-4-6",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}]
  }'`

  return (
    <div>
      <h4 className="mb-4 fw-bold">使用说明</h4>

      <div className="alert alert-info mb-4">
        <i className="bi bi-info-circle me-2" />
        使用前请先在管理页面创建 API Key 和配置上游
      </div>

      <h6 className="fw-bold mb-2">OpenAI 兼容接口</h6>
      <p className="text-muted small mb-2">
        调用 OpenAI 格式的聊天完成接口，支持 gpt-4o、gpt-4o-mini、o1 等模型
      </p>
      <ul className="small text-muted mb-3">
        <li>URL: <code>{BASE_URL}/api/openai/chat/completions</code></li>
        <li>认证: Header <code>Authorization: Bearer YOUR_API_KEY</code></li>
        <li>请求体为 OpenAI ChatCompletion 格式</li>
      </ul>
      <CodeBlock code={openaiCurl} />

      <h6 className="fw-bold mb-2 mt-4">Anthropic 兼容接口</h6>
      <p className="text-muted small mb-2">
        调用 Anthropic 格式的消息接口，支持 claude-opus-4-6、claude-3-5-sonnet 等模型
      </p>
      <ul className="small text-muted mb-3">
        <li>URL: <code>{BASE_URL}/api/anthropic/messages</code></li>
        <li>认证: Header <code>Authorization: Bearer YOUR_API_KEY</code> 或 <code>x-api-key: YOUR_API_KEY</code></li>
        <li>请求体为 Anthropic Messages API 格式</li>
      </ul>
      <CodeBlock code={anthropicCurl} />

      <h6 className="fw-bold mb-2 mt-4">使用 x-api-key Header</h6>
      <p className="text-muted small mb-2">
        如果上游使用 Anthropic 官方 SDK，需要用 x-api-key 方式认证
      </p>
      <CodeBlock code={anthropicCurlWithXApiKey} />
    </div>
  )
}
