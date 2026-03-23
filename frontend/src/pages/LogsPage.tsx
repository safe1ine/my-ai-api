import React, { useEffect, useRef, useState } from 'react'
import { logsApi, LogItem, providersApi, keysApi } from '../api'

const PAGE_SIZE = 100

// ── 列定义 ──────────────────────────────────────────────────────────────────

type ColKey = 'time' | 'status' | 'model' | 'provider' | 'token' | 'stream' | 'input' | 'output' | 'ip' | 'firstToken' | 'latency'

interface ColDef {
  key: ColKey
  label: string
  w?: number
  right?: boolean
  defaultOn: boolean
}

const COL_DEFS: ColDef[] = [
  { key: 'time',       label: '时间',    w: 120,           defaultOn: true  },
  { key: 'status',     label: '状态',    w: 64,            defaultOn: true  },
  { key: 'model',      label: '模型',                      defaultOn: true  },
  { key: 'provider',   label: '上游',    w: 140,           defaultOn: false },
  { key: 'token',      label: 'Token',   w: 140,           defaultOn: false },
  { key: 'stream',     label: '流式',    w: 64,            defaultOn: false },
  { key: 'input',      label: '输入',    w: 90, right: true, defaultOn: true  },
  { key: 'output',     label: '输出',    w: 90, right: true, defaultOn: true  },
  { key: 'ip',         label: 'IP',      w: 110,           defaultOn: false },
  { key: 'firstToken', label: '首Token', w: 80,  right: true, defaultOn: true  },
  { key: 'latency',    label: '耗时',    w: 64,  right: true, defaultOn: true  },
]

const DEFAULT_VISIBLE = new Set<ColKey>(
  COL_DEFS.filter(c => c.defaultOn).map(c => c.key)
)

const LS_KEY = 'logs_visible_cols'

function loadVisibleCols(): Set<ColKey> {
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) {
      const parsed: ColKey[] = JSON.parse(saved)
      const valid = parsed.filter(k => COL_DEFS.some(c => c.key === k))
      if (valid.length > 0) return new Set(valid)
    }
  } catch {}
  return new Set(DEFAULT_VISIBLE)
}

function saveVisibleCols(cols: Set<ColKey>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...cols]))
}

// ── 子组件 ──────────────────────────────────────────────────────────────────

function StatusDot({ status, errorMessage }: { status: 'success' | 'error'; errorMessage?: string | null }) {
  const ok = status === 'success'
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: (!ok && errorMessage) ? 'help' : 'default' }}
      title={!ok && errorMessage ? errorMessage : undefined}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: ok ? '#34a853' : '#ea4335',
        boxShadow: `0 0 0 2px ${ok ? '#e6f4ea' : '#fce8e6'}`,
      }} />
      <span style={{ fontSize: 12, color: ok ? '#137333' : '#c5221f', fontWeight: 500 }}>
        {ok ? 'OK' : 'Err'}
      </span>
    </span>
  )
}

function LatencyBadge({ ms }: { ms: number }) {
  const s = ms / 1000
  const color = ms > 10000 ? '#ea4335' : ms > 5000 ? '#f9ab00' : '#5f6368'
  return <span style={{ color, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{s.toFixed(1)}s</span>
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function DetailSection({ label, content, danger }: { label: string; content: string; danger?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
        {label}
      </div>
      <pre style={{
        background: danger ? '#fff1f2' : '#f8faff',
        border: `1px solid ${danger ? '#fecdd3' : '#e0e7ff'}`,
        borderRadius: 8, padding: '8px 12px',
        fontSize: 12, lineHeight: 1.7, color: danger ? '#be123c' : '#374151',
        fontFamily: 'monospace',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        overflowWrap: 'anywhere',
        maxWidth: '100%',
        minWidth: 0,
      }}>
        {content}
      </pre>
    </div>
  )
}

function ColPicker({ visible, onChange }: {
  visible: Set<ColKey>
  onChange: (next: Set<ColKey>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (key: ColKey) => {
    const next = new Set(visible)
    if (next.has(key)) {
      if (next.size <= 2) return // 至少保留 2 列
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(next)
  }

  const activeCount = visible.size

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 7, fontSize: 13, cursor: 'pointer',
          border: `1px solid ${open ? '#1a73e8' : '#dadce0'}`,
          background: open ? '#e8f0fe' : '#fff',
          color: open ? '#1a73e8' : '#3c4043',
        }}
      >
        <i className="bi bi-layout-three-columns" style={{ fontSize: 13 }} />
        列
        <span style={{
          fontSize: 11, background: '#e8f0fe', color: '#1a73e8',
          borderRadius: 10, padding: '0 5px', fontWeight: 600, lineHeight: '18px',
        }}>{activeCount}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', padding: '8px 0',
          minWidth: 160,
        }}>
          <div style={{ padding: '4px 14px 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            显示列
          </div>
          {COL_DEFS.map(col => {
            const checked = visible.has(col.key)
            return (
              <label
                key={col.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', cursor: 'pointer',
                  fontSize: 13, color: '#374151',
                  background: checked ? '#e8f0fe' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${checked ? '#6366f1' : '#d1d5db'}`,
                  background: checked ? '#6366f1' : '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s',
                }}>
                  {checked && <i className="bi bi-check" style={{ fontSize: 11, color: '#fff', lineHeight: 1 }} />}
                </span>
                <input type="checkbox" checked={checked} onChange={() => toggle(col.key)} style={{ display: 'none' }} />
                {col.label}
              </label>
            )
          })}
          <div style={{ borderTop: '1px solid #f3f4f6', margin: '8px 0 4px' }} />
          <button
            onClick={() => { const d = new Set(DEFAULT_VISIBLE); saveVisibleCols(d); onChange(d) }}
            style={{
              width: '100%', textAlign: 'left', padding: '5px 14px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#9ca3af',
            }}
          >
            <i className="bi bi-arrow-counterclockwise" style={{ marginRight: 5 }} />
            恢复默认
          </button>
        </div>
      )}
    </div>
  )
}

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / pageSize) || 1
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  const btnStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
    minWidth: 32, height: 32, padding: '0 6px',
    border: `1px solid ${active ? '#1a73e8' : '#dadce0'}`,
    borderRadius: 4, background: active ? '#1a73e8' : '#fff',
    color: active ? '#fff' : disabled ? '#dadce0' : '#3c4043',
    fontSize: 13, cursor: disabled ? 'default' : 'pointer',
    fontWeight: active ? 500 : 400,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
      <span style={{ fontSize: 13, color: '#9ca3af' }}>
        共 <strong style={{ color: '#374151' }}>{total}</strong> 条，第 {page} / {totalPages} 页
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btnStyle(false, page === 1)} disabled={page === 1} onClick={() => onChange(page - 1)}>
          <i className="bi bi-chevron-left" style={{ fontSize: 11 }} />
        </button>
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`dot-${i}`} style={{ width: 32, textAlign: 'center', color: '#9ca3af', lineHeight: '32px', fontSize: 13 }}>…</span>
            : <button key={p} style={btnStyle(page === p)} onClick={() => onChange(p as number)}>{p}</button>
        )}
        <button style={btnStyle(false, page === totalPages)} disabled={page === totalPages} onClick={() => onChange(page + 1)}>
          <i className="bi bi-chevron-right" style={{ fontSize: 11 }} />
        </button>
      </div>
    </div>
  )
}

// ── 主页面 ──────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const [items, setItems] = useState<LogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [providerInput, setProviderInput] = useState('')
  const [keyFilter, setKeyFilter] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [providerOptions, setProviderOptions] = useState<string[]>([])
  const [keyOptions, setKeyOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(loadVisibleCols)

  const handleColChange = (next: Set<ColKey>) => {
    setVisibleCols(next)
    saveVisibleCols(next)
  }
  const searchRef = useRef<HTMLInputElement>(null)

  const show = (key: ColKey) => visibleCols.has(key)

  const load = (p = page, sf = statusFilter, mf = modelFilter, pf = providerFilter, kf = keyFilter) => {
    setLoading(true)
    logsApi.list({ page: p, page_size: PAGE_SIZE, status: sf || undefined, model: mf || undefined, provider_name: pf || undefined, key_name: kf || undefined })
      .then(res => { setItems(res.items); setTotal(res.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, statusFilter, modelFilter, providerFilter, keyFilter])
  useEffect(() => {
    providersApi.list().then(ps => setProviderOptions(ps.map(p => p.name)))
    keysApi.list().then(ks => setKeyOptions(ks.map(k => k.name)))
  }, [])

  const handleSearch = () => {
    setPage(1)
    setModelFilter(modelInput)
    setProviderFilter(providerInput)
    setKeyFilter(keyInput)
    load(1, statusFilter, modelInput, providerInput, keyInput)
  }

  const handleStatus = (s: string) => {
    setPage(1)
    setStatusFilter(s)
    load(1, s, modelFilter, providerFilter, keyFilter)
  }

  const handlePageChange = (p: number) => {
    setPage(p)
    setExpandedId(null)
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso + 'Z')  // 后端存储 UTC，加 Z 后按本地时区显示
    return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const hasActiveFilter = statusFilter || modelFilter || providerFilter || keyFilter
  // +1 for the expand chevron column
  const colSpan = visibleCols.size + 1

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 style={{ fontSize: 22, fontWeight: 400, color: '#202124', margin: 0 }}>Logs</h4>
          <p style={{ fontSize: 14, color: '#5f6368', margin: '4px 0 0' }}>查看所有 API 调用记录与详情</p>
        </div>
        <span style={{ background: '#e8f0fe', color: '#1a73e8', fontSize: 13, padding: '6px 14px', borderRadius: 20, fontWeight: 500 }}>
          {total.toLocaleString()} 条记录
        </span>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 16, padding: '12px 16px',
        background: '#fff', borderRadius: 8, border: '1px solid #e8eaed',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { val: '', label: '全部' },
            { val: 'success', label: '成功', color: '#137333', bg: '#e6f4ea' },
            { val: 'error', label: '失败', color: '#c5221f', bg: '#fce8e6' },
          ].map(opt => {
            const active = statusFilter === opt.val
            return (
              <button
                key={opt.val}
                onClick={() => handleStatus(opt.val)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${active ? (opt.color ?? '#1a73e8') : '#dadce0'}`,
                  background: active ? (opt.bg ?? '#e8f0fe') : '#fff',
                  color: active ? (opt.color ?? '#1a73e8') : '#3c4043',
                  fontWeight: active ? 500 : 400, transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, minWidth: 160, maxWidth: 240, display: 'flex', gap: 0 }}>
          <input
            ref={searchRef}
            style={{
              flex: 1, padding: '5px 12px', fontSize: 13,
              border: '1px solid #dadce0', borderRight: 'none',
              borderRadius: '4px 0 0 4px', outline: 'none', background: '#fff',
            }}
            placeholder="搜索模型..."
            value={modelInput}
            onChange={e => setModelInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '5px 12px', border: '1px solid #dadce0',
              borderRadius: '0 4px 4px 0', background: '#fff',
              color: '#5f6368', cursor: 'pointer', fontSize: 13,
            }}
          >
            <i className="bi bi-search" />
          </button>
        </div>

        <select
          value={providerFilter}
          onChange={e => { const v = e.target.value; setProviderFilter(v); setPage(1); load(1, statusFilter, modelFilter, v, keyFilter) }}
          style={{
            padding: '5px 32px 5px 12px', fontSize: 13, borderRadius: 4,
            border: `1px solid ${providerFilter ? '#1a73e8' : '#dadce0'}`,
            background: `${providerFilter ? '#e8f0fe' : '#fff'} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235f6368' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 10px center`,
            color: providerFilter ? '#1a73e8' : '#3c4043',
            cursor: 'pointer', outline: 'none', minWidth: 120,
            appearance: 'none' as any,
          }}
        >
          <option value="">全部上游</option>
          {providerOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>

        <select
          value={keyFilter}
          onChange={e => { const v = e.target.value; setKeyFilter(v); setPage(1); load(1, statusFilter, modelFilter, providerFilter, v) }}
          style={{
            padding: '5px 32px 5px 12px', fontSize: 13, borderRadius: 4,
            border: `1px solid ${keyFilter ? '#1a73e8' : '#dadce0'}`,
            background: `${keyFilter ? '#e8f0fe' : '#fff'} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235f6368' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 10px center`,
            color: keyFilter ? '#1a73e8' : '#3c4043',
            cursor: 'pointer', outline: 'none', minWidth: 120,
            appearance: 'none' as any,
          }}
        >
          <option value="">全部 Token</option>
          {keyOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>

        {hasActiveFilter && (
          <button
            onClick={() => { setStatusFilter(''); setModelFilter(''); setModelInput(''); setProviderFilter(''); setProviderInput(''); setKeyFilter(''); setKeyInput(''); setPage(1) }}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: '1px solid #dadce0', background: '#fff', color: '#5f6368',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <i className="bi bi-x" />清除筛选
          </button>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <ColPicker visible={visibleCols} onChange={handleColChange} />
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e8eaed', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
        <table className="table mb-0" style={{ fontSize: 13 }}>
          <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e8eaed' }}>
            <tr>
              {COL_DEFS.filter(c => show(c.key)).map(col => (
                <th key={col.key} style={{
                  padding: '10px 14px', fontWeight: 500, fontSize: 12,
                  color: '#5f6368', border: 0, width: col.w,
                  textAlign: col.right ? 'right' : 'left',
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  whiteSpace: 'nowrap',
                }}>
                  {col.label}
                </th>
              ))}
              <th style={{ width: 28, border: 0 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} style={{ padding: '48px 0', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#9aa0a6' }}>
                    <div className="spinner-border" style={{ width: 18, height: 18, borderWidth: 2, color: '#1a73e8' }} />
                    <span style={{ fontSize: 14 }}>加载中...</span>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ padding: '48px 0', textAlign: 'center' }}>
                  <i className="bi bi-journal-x" style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 10 }} />
                  <span style={{ color: '#9ca3af', fontSize: 14 }}>
                    {hasActiveFilter ? '没有符合筛选条件的记录' : '暂无调用记录'}
                  </span>
                </td>
              </tr>
            ) : items.map(item => {
              const expanded = expandedId === item.id
              const hasCacheTokens = item.cache_read_tokens > 0 || item.cache_write_tokens > 0
              const hasDetail = item.system_prompt || item.request_summary || item.response_summary || item.error_message || hasCacheTokens
              return (
                <React.Fragment key={item.id}>
                  <tr
                    onClick={() => hasDetail && setExpandedId(expanded ? null : item.id)}
                    style={{
                      borderTop: '1px solid #f3f4f6',
                      cursor: hasDetail ? 'pointer' : 'default',
                      background: expanded ? '#fafbff' : undefined,
                      transition: 'background 0.1s',
                    }}
                  >
                    {show('time') && (
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(item.created_at)}
                      </td>
                    )}
                    {show('status') && (
                      <td style={{ padding: '10px 14px' }}>
                        <StatusDot status={item.status} errorMessage={item.error_message} />
                      </td>
                    )}
                    {show('model') && (
                      <td style={{ padding: '10px 14px' }}>
                        <code style={{ fontSize: 12, background: '#f3f4f6', color: '#374151', padding: '2px 7px', borderRadius: 5 }}>
                          {item.model}
                        </code>
                      </td>
                    )}
                    {show('provider') && (
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.provider_name ?? <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    )}
                    {show('token') && (
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.key_name ?? <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    )}
                    {show('stream') && (
                      <td style={{ padding: '10px 14px' }}>
                        {item.is_stream
                          ? <span style={{ fontSize: 11, background: '#eff6ff', color: '#3b82f6', borderRadius: 5, padding: '2px 7px', fontWeight: 500 }}>流式</span>
                          : <span style={{ fontSize: 11, background: '#f3f4f6', color: '#9ca3af', borderRadius: 5, padding: '2px 7px', fontWeight: 500 }}>同步</span>
                        }
                      </td>
                    )}
                    {show('input') && (
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                          {item.cache_read_tokens > 0 && (
                            <span style={{
                              fontSize: 10, fontVariantNumeric: 'tabular-nums',
                              background: '#f5f3ff', color: '#7c3aed',
                              border: '1px solid #ddd6fe',
                              borderRadius: 4, padding: '1px 5px', lineHeight: '16px',
                            }} title="缓存命中率">
                              {Math.floor(item.cache_read_tokens / (item.input_tokens + item.cache_read_tokens + item.cache_write_tokens) * 1000) / 10}%
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtTokens(item.input_tokens + item.cache_read_tokens + item.cache_write_tokens)}
                          </span>
                        </span>
                      </td>
                    )}
                    {show('output') && (
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ fontSize: 12, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtTokens(item.output_tokens)}
                        </span>
                      </td>
                    )}
                    {show('ip') && (
                      <td style={{ padding: '10px 14px' }}>
                        <code style={{ fontSize: 11, color: '#9ca3af' }}>{item.client_ip ?? '—'}</code>
                      </td>
                    )}
                    {show('firstToken') && (
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <LatencyBadge ms={item.first_token_latency_ms} />
                      </td>
                    )}
                    {show('latency') && (
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <LatencyBadge ms={item.latency_ms} />
                      </td>
                    )}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {hasDetail && (
                        <i
                          className={`bi bi-chevron-${expanded ? 'up' : 'down'}`}
                          style={{ fontSize: 11, color: '#9ca3af' }}
                        />
                      )}
                    </td>
                  </tr>

                    {expanded && hasDetail && (
                    <tr style={{ borderTop: 0 }}>
                      <td colSpan={colSpan} style={{ padding: '14px', background: '#fafbff' }}>
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: 12,
                          minWidth: 0,
                        }}>
                          {hasCacheTokens && (
                            <div style={{ display: 'flex', gap: 12 }}>
                              {item.cache_read_tokens > 0 && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontSize: 12, background: '#f5f3ff', color: '#7c3aed',
                                  borderRadius: 6, padding: '4px 10px', border: '1px solid #ede9fe',
                                }}>
                                  <i className="bi bi-arrow-counterclockwise" />
                                  缓存读取 {fmtTokens(item.cache_read_tokens)} tokens
                                </span>
                              )}
                              {item.cache_write_tokens > 0 && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontSize: 12, background: '#fdf4ff', color: '#a21caf',
                                  borderRadius: 6, padding: '4px 10px', border: '1px solid #f5d0fe',
                                }}>
                                  <i className="bi bi-arrow-clockwise" />
                                  缓存写入 {fmtTokens(item.cache_write_tokens)} tokens
                                </span>
                              )}
                            </div>
                          )}
                          {item.system_prompt && <DetailSection label="System Prompt" content={item.system_prompt} />}
                          {item.request_summary && <DetailSection label="User Message" content={item.request_summary} />}
                          {item.response_summary && <DetailSection label="Response" content={item.response_summary} />}
                          {item.error_message && <DetailSection label="Error" content={item.error_message} danger />}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={handlePageChange} />
    </div>
  )
}
