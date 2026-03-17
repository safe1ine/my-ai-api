import { useEffect, useState } from 'react'
import { keysApi, KeyOut } from '../api'

export default function KeysPage() {
  const [keys, setKeys] = useState<KeyOut[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<KeyOut | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KeyOut | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null)

  const load = () => {
    setLoading(true)
    keysApi.list().then(setKeys).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string, type: 'success' | 'danger' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      showToast('请输入 Key 名称', 'danger')
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
      showToast('删除成功')
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

  const maskKey = (key: string) => {
    if (key.length <= 12) return key.slice(0, 6) + '***'
    return key.slice(0, 8) + '...' + key.slice(-4)
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false })

  return (
    <div>
      <h4 className="mb-4 fw-bold">API Key 管理</h4>

      {toast && (
        <div className={`alert alert-${toast.type} py-2 px-3 mb-3`} style={{ fontSize: 14 }}>
          {toast.msg}
        </div>
      )}

      {/* Create form */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h6 className="fw-semibold mb-3">新建 API Key</h6>
          <div className="d-flex gap-2">
            <input
              className="form-control form-control-sm"
              style={{ maxWidth: 300 }}
              placeholder="输入 Key 名称..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
              {creating ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-plus-lg me-1" />}
              生成 Key
            </button>
          </div>
        </div>
      </div>

      {/* Keys Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="d-flex justify-content-center p-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center text-muted p-5">暂无 API Key</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>名称</th>
                    <th>Key</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k.id}>
                      <td className="fw-semibold">{k.name}</td>
                      <td><code style={{ fontSize: 12 }}>{maskKey(k.key)}</code></td>
                      <td>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={k.is_active}
                            onChange={() => handleToggle(k)}
                          />
                          <label className="form-check-label small">
                            {k.is_active ? '启用' : '禁用'}
                          </label>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{fmtDate(k.created_at)}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleteTarget(k)} title="删除">
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Created Key Modal */}
      <div className="modal fade" id="createKeyModal" tabIndex={-1} data-bs-backdrop="static">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header border-0">
              <h5 className="modal-title">
                <i className="bi bi-check-circle-fill text-success me-2" />
                Key 创建成功
              </h5>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning py-2" style={{ fontSize: 13 }}>
                <i className="bi bi-exclamation-triangle me-1" />
                请立即复制并妥善保存，此 Key 之后将不再完整显示。
              </div>
              {createdKey && (
                <div className="d-flex gap-2 align-items-center">
                  <code
                    className="flex-grow-1 d-block bg-light p-2 rounded"
                    style={{ fontSize: 13, wordBreak: 'break-all' }}
                  >
                    {createdKey.key}
                  </code>
                  <button
                    className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => handleCopy(createdKey.key)}
                  >
                    <i className={`bi ${copied ? 'bi-check' : 'bi-clipboard'}`} />
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer border-0">
              <button className="btn btn-primary" data-bs-dismiss="modal" onClick={() => setCreatedKey(null)}>
                我已复制，关闭
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">确认删除</h5>
              </div>
              <div className="modal-body">
                确认删除 Key <strong>{deleteTarget.name}</strong>？此操作不可撤销。
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>取消</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
