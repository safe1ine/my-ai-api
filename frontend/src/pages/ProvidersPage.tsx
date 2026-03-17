import { useEffect, useRef, useState } from 'react'
import { providersApi, ProviderOut, ProviderCreate } from '../api'

const emptyForm: ProviderCreate & { id?: number } = {
  name: '',
  type: 'openai',
  api_key: '',
  base_url: '',
  is_active: true,
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProviderOut | null>(null)
  const [modelsModal, setModelsModal] = useState<{ name: string; models: string[] } | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const modalRef = useRef<HTMLDivElement>(null)

  const load = () => {
    setLoading(true)
    providersApi.list().then(setProviders).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string, type: 'success' | 'danger' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const openCreate = () => {
    setForm({ ...emptyForm })
    setFormMode('create')
    openModal()
  }

  const openEdit = (p: ProviderOut) => {
    setForm({ id: p.id, name: p.name, type: p.type, api_key: '', base_url: p.base_url ?? '', is_active: p.is_active })
    setFormMode('edit')
    openModal()
  }

  const openModal = () => {
    const el = document.getElementById('providerModal')
    if (el) {
      // @ts-ignore
      const modal = window.bootstrap?.Modal.getOrCreateInstance(el)
      modal?.show()
    }
  }

  const closeModal = () => {
    const el = document.getElementById('providerModal')
    if (el) {
      // @ts-ignore
      const modal = window.bootstrap?.Modal.getInstance(el)
      modal?.hide()
    }
  }

  const handleSubmit = async () => {
    if (!form.name || !form.api_key && formMode === 'create') {
      showToast('请填写必填字段', 'danger')
      return
    }
    setSaving(true)
    try {
      if (formMode === 'create') {
        await providersApi.create({ name: form.name, type: form.type, api_key: form.api_key, base_url: form.base_url || undefined, is_active: form.is_active })
        showToast('上游创建成功')
      } else {
        const body: Record<string, unknown> = { name: form.name, type: form.type, is_active: form.is_active }
        if (form.api_key) body.api_key = form.api_key
        if (form.base_url !== undefined) body.base_url = form.base_url
        await providersApi.update(form.id!, body)
        showToast('上游更新成功')
      }
      closeModal()
      load()
    } catch {
      showToast('操作失败', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await providersApi.delete(deleteTarget.id)
      showToast('删除成功')
      setDeleteTarget(null)
      load()
    } catch {
      showToast('删除失败', 'danger')
    }
  }

  const handleTest = async (p: ProviderOut) => {
    setTestResult(null)
    const res = await providersApi.test(p.id)
    setTestResult({ id: p.id, ok: res.success, msg: res.message })
    setTimeout(() => setTestResult(null), 4000)
  }

  const handleModels = async (p: ProviderOut) => {
    try {
      const res = await providersApi.models(p.id)
      setModelsModal({ name: p.name, models: res.models })
      const el = document.getElementById('modelsModal')
      if (el) {
        // @ts-ignore
        const modal = window.bootstrap?.Modal.getOrCreateInstance(el)
        modal?.show()
      }
    } catch {
      showToast('获取模型列表失败', 'danger')
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0 fw-bold">上游管理</h4>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" />新增上游
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type} py-2 px-3 mb-3`} style={{ fontSize: 14 }}>
          {toast.msg}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`alert alert-${testResult.ok ? 'success' : 'danger'} py-2 px-3 mb-3`} style={{ fontSize: 14 }}>
          {testResult.msg}
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="d-flex justify-content-center p-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center text-muted p-5">暂无上游配置，点击「新增上游」添加</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>名称</th>
                    <th>类型</th>
                    <th>API Key</th>
                    <th>Base URL</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map(p => (
                    <tr key={p.id}>
                      <td className="fw-semibold">{p.name}</td>
                      <td>
                        <span className={`badge bg-${p.type === 'openai' ? 'primary' : 'success'} bg-opacity-10 text-${p.type === 'openai' ? 'primary' : 'success'}`}>
                          {p.type === 'openai' ? 'OpenAI' : 'Anthropic'}
                        </span>
                      </td>
                      <td><code style={{ fontSize: 12 }}>{p.api_key_prefix}...</code></td>
                      <td style={{ fontSize: 12 }}>{p.base_url || <span className="text-muted">默认</span>}</td>
                      <td>
                        <span className={`badge bg-${p.is_active ? 'success' : 'secondary'}`}>
                          {p.is_active ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{fmtDate(p.created_at)}</td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(p)} title="编辑">
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="btn btn-sm btn-outline-info" onClick={() => handleTest(p)} title="测试连通性">
                            <i className="bi bi-wifi" />
                          </button>
                          <button className="btn btn-sm btn-outline-success" onClick={() => handleModels(p)} title="查看模型">
                            <i className="bi bi-list-ul" />
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleteTarget(p)} title="删除">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Provider Form Modal */}
      <div className="modal fade" id="providerModal" tabIndex={-1} ref={modalRef}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{formMode === 'create' ? '新增上游' : '编辑上游'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">名称 <span className="text-danger">*</span></label>
                <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="mb-3">
                <label className="form-label">类型</label>
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'openai' | 'anthropic' }))}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">API Key {formMode === 'create' && <span className="text-danger">*</span>}</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder={formMode === 'edit' ? '留空则不修改' : ''}
                  value={form.api_key}
                  onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Base URL <span className="text-muted small">（可选）</span></label>
                <input className="form-control" placeholder="留空使用默认地址" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} />
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="isActive" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label className="form-check-label" htmlFor="isActive">启用</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">取消</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                保存
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Models Modal */}
      <div className="modal fade" id="modelsModal" tabIndex={-1}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">模型列表 — {modelsModal?.name}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
              {modelsModal?.models.length === 0 ? (
                <div className="text-muted text-center">暂无模型</div>
              ) : (
                <div className="row g-2">
                  {modelsModal?.models.map(m => (
                    <div key={m} className="col-6 col-md-4">
                      <code className="d-block bg-light px-2 py-1 rounded" style={{ fontSize: 12 }}>{m}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">确认删除</h5>
              </div>
              <div className="modal-body">
                确认删除上游 <strong>{deleteTarget.name}</strong>？此操作不可撤销。
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
