import React, { useState, ReactNode } from 'react'

const BASE_URL = window.location.origin

// ── Code Block ────────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
      <pre style={{ margin: 0, padding: '16px 20px 16px 20px', paddingRight: 80, color: '#e2e8f0', fontSize: 13, overflowX: 'auto', lineHeight: 1.7 }}>
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute', top: 10, right: 10,
          background: copied ? '#166534' : 'rgba(255,255,255,0.1)',
          border: 'none', borderRadius: 6, padding: '4px 10px',
          color: copied ? '#86efac' : '#94a3b8', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
        }}
      >
        <i className={`bi ${copied ? 'bi-check' : 'bi-clipboard'}`} />
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}

// ── Tab Group ─────────────────────────────────────────────────────────────

function TabGroup({ tabs }: { tabs: { label: string; icon: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(0)
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
            background: active === i ? '#fff' : 'transparent',
            color: active === i ? '#6366f1' : '#6b7280',
            fontWeight: active === i ? 600 : 400,
            borderBottom: active === i ? '2px solid #6366f1' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
          }}>
            <i className={`bi ${t.icon}`} style={{ fontSize: 12 }} />{t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 16 }}>{tabs[active].content}</div>
    </div>
  )
}

// ── Code Generators ───────────────────────────────────────────────────────

interface Params {
  system: string
  user: string
  stream: boolean
  apiKey: string
}

function escStr(s: string) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") }

function buildOpenAiBody(p: Params, model: string) {
  const msgs: object[] = []
  if (p.system.trim()) msgs.push({ role: 'system', content: p.system })
  msgs.push({ role: 'user', content: p.user || '你好' })
  const body: Record<string, unknown> = { model, messages: msgs }
  if (p.stream) body.stream = true
  return body
}

function buildAnthropicBody(p: Params, model: string) {
  const msgs = [{ role: 'user', content: p.user || '你好' }]
  const body: Record<string, unknown> = { model, max_tokens: 1024, messages: msgs }
  if (p.system.trim()) body.system = p.system
  if (p.stream) body.stream = true
  return body
}

function genOpenAiCurl(p: Params, model: string) {
  const body = buildOpenAiBody(p, model)
  const key = p.apiKey || 'YOUR_API_KEY'
  const lines = [
    `curl ${BASE_URL}/api/openai/chat/completions \\`,
    `  -H "Authorization: Bearer ${escStr(key)}" \\`,
    `  -H "Content-Type: application/json" \\`,
    ...(p.stream ? [`  --no-buffer \\`] : []),
    `  -d '${JSON.stringify(body, null, 4).replace(/\n/g, '\n  ')}'`,
  ]
  return lines.join('\n')
}

function genOpenAiPython(p: Params, model: string) {
  const key = p.apiKey || 'YOUR_API_KEY'
  const msgs: string[] = []
  if (p.system.trim()) msgs.push(`        {"role": "system", "content": ${JSON.stringify(p.system)}},`)
  msgs.push(`        {"role": "user", "content": ${JSON.stringify(p.user || '你好')}},`)

  if (p.stream) {
    return `from openai import OpenAI

client = OpenAI(
    base_url="${BASE_URL}/api/openai",
    api_key=${JSON.stringify(key)},
)

with client.chat.completions.stream(
    model=${JSON.stringify(model)},
    messages=[
${msgs.join('\n')}
    ],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)`
  }
  return `from openai import OpenAI

client = OpenAI(
    base_url="${BASE_URL}/api/openai",
    api_key=${JSON.stringify(key)},
)

response = client.chat.completions.create(
    model=${JSON.stringify(model)},
    messages=[
${msgs.join('\n')}
    ],
)
print(response.choices[0].message.content)`
}

function genOpenAiJs(p: Params, model: string) {
  const key = p.apiKey || 'YOUR_API_KEY'
  const msgs: string[] = []
  if (p.system.trim()) msgs.push(`    { role: "system", content: ${JSON.stringify(p.system)} },`)
  msgs.push(`    { role: "user", content: ${JSON.stringify(p.user || '你好')} },`)

  if (p.stream) {
    return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE_URL}/api/openai",
  apiKey: ${JSON.stringify(key)},
});

const stream = await client.chat.completions.create({
  model: ${JSON.stringify(model)},
  stream: true,
  messages: [
${msgs.join('\n')}
  ],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`
  }
  return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE_URL}/api/openai",
  apiKey: ${JSON.stringify(key)},
});

const response = await client.chat.completions.create({
  model: ${JSON.stringify(model)},
  messages: [
${msgs.join('\n')}
  ],
});
console.log(response.choices[0].message.content);`
}

function genAnthropicCurl(p: Params, model: string) {
  const body = buildAnthropicBody(p, model)
  const key = p.apiKey || 'YOUR_API_KEY'
  const lines = [
    `curl ${BASE_URL}/api/anthropic/messages \\`,
    `  -H "Authorization: Bearer ${escStr(key)}" \\`,
    `  -H "Content-Type: application/json" \\`,
    ...(p.stream ? [`  --no-buffer \\`] : []),
    `  -d '${JSON.stringify(body, null, 4).replace(/\n/g, '\n  ')}'`,
  ]
  return lines.join('\n')
}

function genAnthropicPython(p: Params, model: string) {
  const key = p.apiKey || 'YOUR_API_KEY'
  const sysArg = p.system.trim() ? `\n    system=${JSON.stringify(p.system)},` : ''

  if (p.stream) {
    return `import anthropic

client = anthropic.Anthropic(
    base_url="${BASE_URL}/api/anthropic",
    api_key=${JSON.stringify(key)},
)

with client.messages.stream(
    model=${JSON.stringify(model)},
    max_tokens=1024,${sysArg}
    messages=[{"role": "user", "content": ${JSON.stringify(p.user || '你好')}}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)`
  }
  return `import anthropic

client = anthropic.Anthropic(
    base_url="${BASE_URL}/api/anthropic",
    api_key=${JSON.stringify(key)},
)

message = client.messages.create(
    model=${JSON.stringify(model)},
    max_tokens=1024,${sysArg}
    messages=[{"role": "user", "content": ${JSON.stringify(p.user || '你好')}}],
)
print(message.content[0].text)`
}

function genAnthropicJs(p: Params, model: string) {
  const key = p.apiKey || 'YOUR_API_KEY'
  const sysArg = p.system.trim() ? `\n  system: ${JSON.stringify(p.system)},` : ''

  if (p.stream) {
    return `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "${BASE_URL}/api/anthropic",
  apiKey: ${JSON.stringify(key)},
});

const stream = await client.messages.stream({
  model: ${JSON.stringify(model)},
  max_tokens: 1024,${sysArg}
  messages: [{ role: "user", content: ${JSON.stringify(p.user || '你好')} }],
});

for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    process.stdout.write(event.delta.text);
  }
}`
  }
  return `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "${BASE_URL}/api/anthropic",
  apiKey: ${JSON.stringify(key)},
});

const message = await client.messages.create({
  model: ${JSON.stringify(model)},
  max_tokens: 1024,${sysArg}
  messages: [{ role: "user", content: ${JSON.stringify(p.user || '你好')} }],
});
console.log(message.content[0].text);`
}

// ── Toggle ────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
    >
      <div style={{
        width: 40, height: 22, borderRadius: 11, position: 'relative',
        background: value ? '#6366f1' : '#d1d5db', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 13, color: value ? '#4338ca' : '#6b7280', fontWeight: value ? 500 : 400 }}>
        {label}
      </span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini']
const ANTHROPIC_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

export default function DocsPage() {
  const [user, setUser] = useState('你好')
  const [system, setSystem] = useState('')
  const [showSystem, setShowSystem] = useState(false)
  const [stream, setStream] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [openaiModel, setOpenaiModel] = useState(OPENAI_MODELS[0])
  const [anthropicModel, setAnthropicModel] = useState(ANTHROPIC_MODELS[0])

  const params: Params = { system, user, stream, apiKey }

  const urlStyle: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 13, background: '#f3f4f6',
    color: '#374151', padding: '3px 9px', borderRadius: 6, wordBreak: 'break-all',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: 13,
    border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none',
    background: '#fff', color: '#1e293b', resize: 'vertical',
    fontFamily: 'inherit', lineHeight: 1.5,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, display: 'block',
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1">使用说明</h4>
          <p className="text-muted mb-0" style={{ fontSize: 14 }}>接入指南与 SDK 示例</p>
        </div>
      </div>

      {/* Tip */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '12px 16px', marginBottom: 24,
        display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#1e40af',
      }}>
        <i className="bi bi-info-circle-fill" style={{ marginTop: 1, flexShrink: 0 }} />
        <span>使用前请先在 <strong>API Token</strong> 页面创建访问凭证，并在 <strong>Upstream</strong> 页面配置上游供应商。</span>
      </div>

      {/* ── 参数配置面板 ── */}
      <div style={{
        border: '1px solid #e0e7ff', borderRadius: 12, marginBottom: 28,
        background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 18px', background: 'rgba(99,102,241,0.06)',
          borderBottom: '1px solid #e0e7ff',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="bi bi-sliders" style={{ color: '#6366f1', fontSize: 14 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4338ca' }}>参数配置</span>
          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 4 }}>修改后代码示例实时更新</span>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* User message */}
          <div>
            <label style={labelStyle}>用户消息</label>
            <textarea
              style={{ ...inputStyle, minHeight: 64 }}
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="输入用户消息..."
            />
          </div>

          {/* System prompt toggle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showSystem ? 8 : 0 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>系统提示词（可选）</label>
              <button
                onClick={() => { setShowSystem(!showSystem); if (showSystem) setSystem('') }}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer', fontSize: 12,
                  color: showSystem ? '#ef4444' : '#6366f1', padding: '2px 8px',
                  borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <i className={`bi ${showSystem ? 'bi-dash-lg' : 'bi-plus-lg'}`} />
                {showSystem ? '移除' : '添加'}
              </button>
            </div>
            {showSystem && (
              <textarea
                style={{ ...inputStyle, minHeight: 72 }}
                value={system}
                onChange={e => setSystem(e.target.value)}
                placeholder="输入系统提示词..."
                autoFocus
              />
            )}
          </div>

          {/* Bottom row: stream toggle + api key */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ paddingBottom: 2 }}>
              <Toggle value={stream} onChange={setStream} label={stream ? '流式输出（Stream）' : '非流式输出'} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>API Key（填入后自动替换示例中的占位符）</label>
              <input
                style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace' }}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                type="password"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── OpenAI ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-stars" style={{ color: '#10a37f', fontSize: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>OpenAI 兼容接口</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>支持 GPT-4o、o1、o3 等模型</div>
            </div>
          </div>
          <select
            value={openaiModel}
            onChange={e => setOpenaiModel(e.target.value)}
            style={{
              padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb',
              fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
            }}
          >
            {OPENAI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#9ca3af', width: 64, flexShrink: 0 }}>Base URL</span>
            <code style={urlStyle}>{BASE_URL}/api/openai</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#9ca3af', width: 64, flexShrink: 0 }}>Endpoint</span>
            <code style={urlStyle}>{BASE_URL}/api/openai/chat/completions</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#9ca3af', width: 64, flexShrink: 0 }}>Auth</span>
            <code style={urlStyle}>Authorization: Bearer YOUR_API_KEY</code>
          </div>
        </div>

        <TabGroup tabs={[
          { label: 'cURL', icon: 'bi-terminal', content: <CodeBlock code={genOpenAiCurl(params, openaiModel)} /> },
          { label: 'Python', icon: 'bi-filetype-py', content: <CodeBlock code={genOpenAiPython(params, openaiModel)} /> },
          { label: 'JavaScript', icon: 'bi-filetype-js', content: <CodeBlock code={genOpenAiJs(params, openaiModel)} /> },
        ]} />
      </div>

      {/* ── Anthropic ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-cpu" style={{ color: '#d97706', fontSize: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Anthropic 兼容接口</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>支持 Claude Opus、Sonnet、Haiku 等模型</div>
            </div>
          </div>
          <select
            value={anthropicModel}
            onChange={e => setAnthropicModel(e.target.value)}
            style={{
              padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb',
              fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
            }}
          >
            {ANTHROPIC_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#9ca3af', width: 64, flexShrink: 0 }}>Base URL</span>
            <code style={urlStyle}>{BASE_URL}/api/anthropic</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#9ca3af', width: 64, flexShrink: 0 }}>Endpoint</span>
            <code style={urlStyle}>{BASE_URL}/api/anthropic/messages</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#9ca3af', width: 64, flexShrink: 0 }}>Auth</span>
            <code style={urlStyle}>Authorization: Bearer YOUR_API_KEY</code>
            <span style={{ color: '#d1d5db', fontSize: 12 }}>或</span>
            <code style={urlStyle}>x-api-key: YOUR_API_KEY</code>
          </div>
        </div>

        <TabGroup tabs={[
          { label: 'cURL', icon: 'bi-terminal', content: <CodeBlock code={genAnthropicCurl(params, anthropicModel)} /> },
          { label: 'Python', icon: 'bi-filetype-py', content: <CodeBlock code={genAnthropicPython(params, anthropicModel)} /> },
          { label: 'JavaScript', icon: 'bi-filetype-js', content: <CodeBlock code={genAnthropicJs(params, anthropicModel)} /> },
        ]} />
      </div>
    </div>
  )
}
