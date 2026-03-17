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
  const openaiPythonExample = `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",  # 使用本站颁发的 API Key
    base_url="${BASE_URL}/v1",
)

# 调用 OpenAI 兼容模型
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)

# 调用 Anthropic 模型（模型名以 claude 开头时自动路由）
response = client.chat.completions.create(
    model="claude-opus-4-6",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`

  const openaiJsExample = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-your-api-key",  // 使用本站颁发的 API Key
  baseURL: "${BASE_URL}/v1",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`

  const anthropicExample = `import anthropic

client = anthropic.Anthropic(
    api_key="sk-your-api-key",  # 使用本站颁发的 API Key
    base_url="${BASE_URL}",
)

message = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
)
print(message.content[0].text)`

  const curlExample = `curl ${BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`

  return (
    <div>
      <h4 className="mb-4 fw-bold">使用说明</h4>

      {/* Quick Info */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-semibold mb-2">
                <i className="bi bi-globe me-2 text-primary" />
                接入地址
              </h6>
              <code className="d-block bg-light p-2 rounded">{BASE_URL}</code>
              <div className="text-muted mt-2" style={{ fontSize: 13 }}>
                OpenAI 兼容接口：<code>{BASE_URL}/v1</code>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-semibold mb-2">
                <i className="bi bi-shield-lock me-2 text-primary" />
                鉴权方式
              </h6>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                在请求 Header 中携带：
              </p>
              <code className="d-block bg-light p-2 rounded mt-1">Authorization: Bearer sk-your-api-key</code>
            </div>
          </div>
        </div>
      </div>

      {/* Routing */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h6 className="fw-semibold mb-2">
            <i className="bi bi-diagram-3 me-2 text-primary" />
            模型路由规则
          </h6>
          <div className="d-flex gap-4 flex-wrap" style={{ fontSize: 14 }}>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-success">claude-*</span>
              <i className="bi bi-arrow-right text-muted" />
              <span>自动转发至 Anthropic 上游</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary">gpt-* / o1-* / 其他</span>
              <i className="bi bi-arrow-right text-muted" />
              <span>自动转发至 OpenAI 上游</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">
            <i className="bi bi-rocket me-2 text-primary" />
            快速开始
          </h6>
          <ol className="mb-0" style={{ fontSize: 14, lineHeight: 2 }}>
            <li>在「上游管理」页面添加至少一个上游（OpenAI 或 Anthropic）并启用</li>
            <li>在「API Key 管理」页面创建一个 API Key，复制并保存完整 Key 值</li>
            <li>将 Base URL 设为 <code>{BASE_URL}/v1</code>，API Key 替换为本站颁发的 Key</li>
            <li>按需选择模型，调用即可</li>
          </ol>
        </div>
      </div>

      {/* Examples */}
      <div className="accordion mb-4" id="docsAccordion">
        {[
          {
            id: 'python-openai',
            title: 'Python · OpenAI SDK',
            badge: 'OpenAI 兼容',
            code: openaiPythonExample,
          },
          {
            id: 'js-openai',
            title: 'JavaScript / Node.js · OpenAI SDK',
            badge: 'OpenAI 兼容',
            code: openaiJsExample,
          },
          {
            id: 'python-anthropic',
            title: 'Python · Anthropic 原生接口',
            badge: 'Anthropic 原生',
            badgeColor: 'success',
            code: anthropicExample,
          },
          {
            id: 'curl',
            title: 'cURL',
            badge: 'REST API',
            badgeColor: 'secondary',
            code: curlExample,
          },
        ].map((item, i) => (
          <div className="accordion-item border-0 shadow-sm mb-2 rounded overflow-hidden" key={item.id}>
            <h2 className="accordion-header">
              <button
                className={`accordion-button ${i > 0 ? 'collapsed' : ''} fw-semibold`}
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#collapse-${item.id}`}
                style={{ fontSize: 14 }}
              >
                <span className={`badge bg-${item.badgeColor ?? 'primary'} me-2`}>{item.badge}</span>
                {item.title}
              </button>
            </h2>
            <div
              id={`collapse-${item.id}`}
              className={`accordion-collapse collapse ${i === 0 ? 'show' : ''}`}
              data-bs-parent="#docsAccordion"
            >
              <div className="accordion-body pt-2">
                <CodeBlock code={item.code} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
