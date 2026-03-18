import { useEffect, useRef, useState } from 'react'
import { keysApi, KeyOut, KeyTokenStats } from '../api'

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function KeysPage() {
  const [keys, setKeys] = useState<KeyOut[]>([])
  const [loading, setLoading] = useState(true)
  const [tokenStats, setTokenStats] = useState<Record<number, KeyTokenStats>>({})
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<KeyOut | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedRowId, setCopiedRowId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KeyOut | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      keysApi.list(),
      keysApi.tokenStats(),
    ]).then(([keyList, stats]) => {
      setKeys(keyList)
      const map: Record<number, KeyTokenStats> = {}
      for (const s of stats) map[s.client_key_id] = s
      setTokenStats(map)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string, type: 'success' | 'danger' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      inputRef.current?.focus()
      showToast('请输入 Token 名称', 'danger')
      return
    }
    setCreating(true)
    try {
      const key = await keysApi.create(newName.trim())
      setCreatedKey(key)
      setNewName('')
      load()
      const el = document.getElementById('createKeyModal')
      if (el) {
        // @ts-ignore
        window.bootstrap?.Modal.getOrCreateInstance(el)?.show()
      }
    } catch {
      showToast('创建失败', 'danger')
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (k: KeyOut) => {
    try {
      await keysApi.update(k.id, { is_active: !k.is_active })
      load()
    } catch {
      showToast('操作失败', 'danger')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await keysApi.delete(deleteTarget.id)
      showToast('已删除')
      setDeleteTarget(null)
      load()
    } catch {
      showToast('删除失败', 'danger')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleCopyRow = (id: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedRowId(id)
      setTimeout(() => setCopiedRowId(null), 2000)
    })
  }

  const maskKey = (key: string) => key.slice(0, 10) + '••••••••••••' + key.slice(-4)

  const fmtDate = (iso: string) => new Date(iso + 'Z').toLocaleString('zh-CN', { hour12: false })

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', top: 24, right: 24, zIndex: 9999,
            minWidth: 240, maxWidth: 360,
            background: toast.type === 'success' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
            color: toast.type === 'success' ? '#166534' : '#991b1b',
            borderRadius: 10, padding: '10px 16px', fontSize: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1">API Token</h4>
          <p className="text-muted mb-0" style={{ fontSize: 14 }}>管理用于访问 API 的凭证，请妥善保管</p>
        </div>
        <span className="badge rounded-pill" style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 13, padding: '6px 14px' }}>
          {keys.length} 个 Token
        </span>
      </div>

      {/* Create form */}
      <div
        className="mb-4 p-4"
        style={{
          background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
          border: '1px solid #e0e7ff',
          borderRadius: 12,
        }}
      >
        <div className="d-flex align-items-center gap-2 mb-3">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="bi bi-plus-lg text-white" style={{ fontSize: 16 }} />
          </div>
          <span className="fw-semibold" style={{ fontSize: 15 }}>新建 Token</span>
        </div>
        <div className="d-flex gap-2" style={{ maxWidth: 480 }}>
          <input
            ref={inputRef}
            className="form-control"
            style={{ borderRadius: 8, borderColor: '#c7d2fe', fontSize: 14 }}
            placeholder="输入 Token 名称，如：开发环境、生产服务"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button
            className="btn btn-primary px-4"
            style={{ borderRadius: 8, whiteSpace: 'nowrap', background: '#6366f1', border: 'none' }}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating
              ? <span className="spinner-border spinner-border-sm me-2" />
              : <i className="bi bi-key-fill me-2" />
            }
            生成 Token
          </button>
        </div>
      </div>

      {/* Token List */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary me-3" style={{ width: 20, height: 20, borderWidth: 2 }} />
            <span className="text-muted" style={{ fontSize: 14 }}>加载中...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center p-5">
            <i className="bi bi-key" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
            <div className="text-muted" style={{ fontSize: 14 }}>还没有 Token，新建一个开始使用</div>
          </div>
        ) : (
          <table className="table table-hover mb-0 align-middle">
            <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '12px 20px', fontWeight: 600, fontSize: 13, color: '#374151', border: 0 }}>名称</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, fontSize: 13, color: '#374151', border: 0 }}>Token</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, fontSize: 13, color: '#374151', border: 0 }}>Token 用量</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, fontSize: 13, color: '#374151', border: 0 }}>状态</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, fontSize: 13, color: '#374151', border: 0 }}>创建时间</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, fontSize: 13, color: '#374151', border: 0, width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="fw-semibold" style={{ fontSize: 14 }}>{k.name}</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div className="d-flex align-items-center gap-2">
                      <code
                        style={{
                          fontSize: 12,
                          background: '#f3f4f6',
                          color: '#374151',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontFamily: 'monospace',
                          letterSpacing: 0.5,
                        }}
                      >
                        {maskKey(k.key)}
                      </code>
                      <button
                        onClick={() => handleCopyRow(k.id, k.key)}
                        title="复制完整 Token"
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: '4px 6px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: copiedRowId === k.id ? '#16a34a' : '#9ca3af',
                          transition: 'color 0.15s',
                          fontSize: 14,
                        }}
                      >
                        <i className={`bi ${copiedRowId === k.id ? 'bi-check-lg' : 'bi-clipboard'}`} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {(() => {
                      const s = tokenStats[k.id]
                      if (!s || (s.total_input_tokens === 0 && s.total_output_tokens === 0)) {
                        return <span style={{ fontSize: 12, color: '#9ca3af' }}>--</span>
                      }
                      return (
                        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ color: '#6b7280' }}>总计</span>
                            <span style={{ color: '#2563eb', fontWeight: 500 }} title={`输入 ${s.total_input_tokens.toLocaleString()}`}>
                              <i className="bi bi-arrow-up-short" style={{ fontSize: 11 }} />{fmtTokens(s.total_input_tokens)}
                            </span>
                            <span style={{ color: '#16a34a', fontWeight: 500 }} title={`输出 ${s.total_output_tokens.toLocaleString()}`}>
                              <i className="bi bi-arrow-down-short" style={{ fontSize: 11 }} />{fmtTokens(s.total_output_tokens)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ color: '#6b7280' }}>今日</span>
                            <span style={{ color: '#2563eb', fontWeight: 500 }} title={`输入 ${s.today_input_tokens.toLocaleString()}`}>
                              <i className="bi bi-arrow-up-short" style={{ fontSize: 11 }} />{fmtTokens(s.today_input_tokens)}
                            </span>
                            <span style={{ color: '#16a34a', fontWeight: 500 }} title={`输出 ${s.today_output_tokens.toLocaleString()}`}>
                              <i className="bi bi-arrow-down-short" style={{ fontSize: 11 }} />{fmtTokens(s.today_output_tokens)}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div
                      onClick={() => handleToggle(k)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                        background: k.is_active ? '#dcfce7' : '#f3f4f6',
                        color: k.is_active ? '#16a34a' : '#6b7280',
                        fontSize: 12, fontWeight: 500, userSelect: 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span
                        style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: k.is_active ? '#22c55e' : '#d1d5db',
                        }}
                      />
                      {k.is_active ? '已启用' : '已禁用'}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>
                    {fmtDate(k.created_at)}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => setDeleteTarget(k)}
                      title="删除"
                      style={{
                        border: 'none', background: 'none',
                        padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                        color: '#d1d5db', fontSize: 15, transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Created Key Modal */}
      <div className="modal fade" id="createKeyModal" tabIndex={-1} data-bs-backdrop="static">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content" style={{ borderRadius: 16, border: 'none', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', padding: '24px 24px 20px' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="bi bi-check-lg text-white" style={{ fontSize: 22 }} />
                </div>
                <div>
                  <h5 className="text-white mb-0 fw-bold">Token 创建成功</h5>
                  <p className="mb-0" style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>请立即复制并妥善保存</p>
                </div>
              </div>
            </div>
            <div className="modal-body p-4">
              <div
                style={{
                  background: '#fff8ed', border: '1px solid #fed7aa',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e',
                  marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start',
                }}
              >
                <i className="bi bi-exclamation-triangle-fill" style={{ marginTop: 1, flexShrink: 0 }} />
                <span>出于安全考虑，此 Token 仅在此刻完整显示，关闭后将无法再次查看完整内容。</span>
              </div>
              {createdKey && (
                <div
                  style={{
                    background: '#f8faff', border: '1px solid #e0e7ff',
                    borderRadius: 10, padding: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <code
                    style={{
                      flex: 1, fontSize: 13, wordBreak: 'break-all',
                      fontFamily: 'monospace', color: '#1e293b', lineHeight: 1.6,
                    }}
                  >
                    {createdKey.key}
                  </code>
                  <button
                    onClick={() => handleCopy(createdKey.key)}
                    style={{
                      flexShrink: 0, border: 'none', borderRadius: 8,
                      padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                      fontWeight: 500, transition: 'all 0.2s',
                      background: copied ? '#dcfce7' : '#6366f1',
                      color: copied ? '#16a34a' : '#fff',
                    }}
                  >
                    <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'} me-1`} />
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer border-0 pt-0 px-4 pb-4">
              <button
                className="btn w-100"
                style={{ background: '#6366f1', color: '#fff', borderRadius: 8, padding: '10px', fontWeight: 500 }}
                data-bs-dismiss="modal"
                onClick={() => setCreatedKey(null)}
              >
                我已保存，关闭
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1050,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="d-flex align-items-center gap-3 mb-3">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-trash" style={{ color: '#ef4444', fontSize: 18 }} />
              </div>
              <h5 className="mb-0 fw-bold" style={{ fontSize: 16 }}>删除 Token</h5>
            </div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              确认删除 <strong style={{ color: '#111' }}>{deleteTarget.name}</strong>？使用该 Token 的请求将立即失效，此操作不可撤销。
            </p>
            <div className="d-flex gap-2">
              <button
                className="btn flex-grow-1"
                style={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14 }}
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </button>
              <button
                className="btn flex-grow-1"
                style={{ borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontSize: 14 }}
                onClick={handleDelete}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
