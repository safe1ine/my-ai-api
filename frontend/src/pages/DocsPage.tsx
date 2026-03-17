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
    <div className="position-relative mb-4" style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <pre
        className="p-4 mb-0"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#e2e8f0', fontSize: 13, overflowX: 'auto' }}
      >
        <code>{code}</code>
      </pre>
      <button
        className={`btn btn-sm position-absolute top-0 end-0 m-2 ${copied ? 'btn-success' : 'btn-light'}`}
        style={{ fontSize: 12, opacity: 0.9 }}
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
      <h4 className="mb-4 fw-bold" style={{ color: '#1e293b' }}>使用说明</h4>

      <div className="alert mb-4" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: 'none', color: '#1e40af' }}>
        <i className="bi bi-info-circle me-2" />
        使用前请先在管理页面创建 API Key 和配置上游
      </div>

      <div className="mb-4" style={{ padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h6 className="fw-bold mb-3" style={{ color: '#0f172a' }}>
          <i className="bi bi-robot me-2" style={{ color: '#3b82f6' }} />
          OpenAI 兼容接口
        </h6>
        <p className="text-muted mb-3" style={{ fontSize: 14 }}>
          调用 OpenAI 格式的聊天完成接口，支持 gpt-4o、gpt-4o-mini、o1 等模型
        </p>
        <ul className="text-muted mb-3" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <li>URL: <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{BASE_URL}/api/openai/chat/completions</code></li>
          <li>认证: Header <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>Authorization: Bearer YOUR_API_KEY</code></li>
          <li>请求体为 OpenAI ChatCompletion 格式</li>
        </ul>
      </div>

      <CodeBlock code={openaiCurl} />

      <div className="mb-4" style={{ padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h6 className="fw-bold mb-3" style={{ color: '#0f172a' }}>
          <i className="bi bi-cpu me-2" style={{ color: '#8b5cf6' }} />
          Anthropic 兼容接口
        </h6>
        <p className="text-muted mb-3" style={{ fontSize: 14 }}>
          调用 Anthropic 格式的消息接口，支持 claude-opus-4-6、claude-3-5-sonnet 等模型
        </p>
        <ul className="text-muted mb-3" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <li>URL: <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{BASE_URL}/api/anthropic/messages</code></li>
          <li>认证: <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>Authorization: Bearer YOUR_API_KEY</code> 或 <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>x-api-key: YOUR_API_KEY</code></li>
          <li>请求体为 Anthropic Messages API 格式</li>
        </ul>
      </div>

      <CodeBlock code={anthropicCurl} />

      <div className="mb-4" style={{ padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h6 className="fw-bold mb-3" style={{ color: '#0f172a' }}>
          <i className="bi bi-key me-2" style={{ color: '#10b981' }} />
          使用 x-api-key Header
        </h6>
        <p className="text-muted mb-0" style={{ fontSize: 14 }}>
          如果上游使用 Anthropic 官方 SDK，需要用 x-api-key 方式认证
        </p>
      </div>

      <CodeBlock code={anthropicCurlWithXApiKey} />
    </div>
  )
}
