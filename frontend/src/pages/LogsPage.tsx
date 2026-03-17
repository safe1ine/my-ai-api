import React, { useEffect, useState } from 'react'
import { logsApi, LogItem } from '../api'

export default function LogsPage() {
  const [items, setItems] = useState<LogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const pageSize = 20

  const load = (p = page, sf = statusFilter, mf = modelFilter) => {
    setLoading(true)
    logsApi.list({ page: p, page_size: pageSize, status: sf || undefined, model: mf || undefined })
      .then(res => {
        setItems(res.items)
        setTotal(res.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, statusFilter, modelFilter])

  const totalPages = Math.ceil(total / pageSize) || 1

  const handleSearch = () => {
    setPage(1)
    setModelFilter(modelInput)
    load(1, statusFilter, modelInput)
  }

  const handleStatus = (s: string) => {
    setPage(1)
    setStatusFilter(s)
    load(1, s, modelFilter)
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    const offset = 8 * 60
    const local = new Date(d.getTime() + offset * 60000)
    return local.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0 fw-bold" style={{ color: '#1e293b' }}>调用记录</h4>
        <span className="text-muted" style={{ fontSize: 14 }}>共 {total} 条</span>
      </div>

      {/* Filters */}
      <div className="d-flex gap-3 mb-4 align-items-center flex-wrap">
        <div className="btn-group">
          {[
            { val: '', label: '全部' },
            { val: 'success', label: '成功' },
            { val: 'error', label: '失败' },
          ].map(opt => (
            <button
              key={opt.val}
              className={`btn btn-sm ${statusFilter === opt.val ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleStatus(opt.val)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="input-group" style={{ width: 280 }}>
          <input
            className="form-control form-control-sm"
            placeholder="搜索模型..."
            value={modelInput}
            onChange={e => setModelInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-sm btn-outline-secondary" onClick={handleSearch}>
            <i className="bi bi-search" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div className="table-responsive">
          <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th className="fw-semibold py-3" style={{ width: 140 }}>时间</th>
                <th className="fw-semibold py-3" style={{ width: 50 }}>状态</th>
                <th className="fw-semibold py-3">模型</th>
                <th className="fw-semibold py-3" style={{ width: 70 }}>上游</th>
                <th className="fw-semibold py-3" style={{ width: 80 }}>Key</th>
                <th className="fw-semibold py-3" style={{ width: 100 }}>IP</th>
                <th className="text-end fw-semibold py-3" style={{ width: 70 }}>Input</th>
                <th className="text-end fw-semibold py-3" style={{ width: 70 }}>Output</th>
                <th className="text-end fw-semibold py-3" style={{ width: 90 }}>首token</th>
                <th className="text-end fw-semibold py-3" style={{ width: 70 }}>耗时</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-5">
                    <div className="spinner-border spinner-border-sm text-primary" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-5">暂无数据</td>
                </tr>
              ) : (
                items.map(item => (
                  <React.Fragment key={item.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="py-2" style={{ fontSize: 12 }}>{fmtDate(item.created_at)}</td>
                      <td className="py-2">
                        <span className={`badge bg-${item.status === 'success' ? 'success' : 'danger'}`} style={{ fontSize: 11 }}>
                          {item.status === 'success' ? '成功' : '失败'}
                        </span>
                      </td>
                      <td className="py-2" style={{ fontSize: 12 }}><code>{item.model}</code></td>
                      <td className="py-2" style={{ fontSize: 12 }}>{item.provider_name ?? '-'}</td>
                      <td className="py-2" style={{ fontSize: 12 }}>{item.key_name ?? '-'}</td>
                      <td className="py-2" style={{ fontSize: 12 }}><code>{item.client_ip ?? '-'}</code></td>
                      <td className="text-end py-2" style={{ fontSize: 12 }}>{item.input_tokens.toLocaleString()}</td>
                      <td className="text-end py-2" style={{ fontSize: 12 }}>{item.output_tokens.toLocaleString()}</td>
                      <td className="text-end py-2" style={{ fontSize: 12 }}>{(item.first_token_latency_ms / 1000).toFixed(1)}s</td>
                      <td className="text-end py-2" style={{ fontSize: 12 }}>{(item.latency_ms / 1000).toFixed(1)}s</td>
                    </tr>
                    {expandedId === item.id && (
                      <tr>
                        <td colSpan={10} className="p-3" style={{ background: '#f8fafc' }}>
                          <div className="row g-3">
                            {item.system_prompt && (
                              <div className="col-12">
                                <span className="text-muted small d-block mb-1">系统提示词</span>
                                <div className="bg-white p-2 rounded small" style={{ maxHeight: 80, overflow: 'auto', fontSize: 12 }}>
                                  {item.system_prompt}
                                </div>
                              </div>
                            )}
                            {item.request_summary && (
                              <div className="col-12">
                                <span className="text-muted small d-block mb-1">用户提示词</span>
                                <div className="bg-white p-2 rounded small" style={{ maxHeight: 80, overflow: 'auto', fontSize: 12 }}>
                                  {item.request_summary}
                                </div>
                              </div>
                            )}
                            {item.response_summary && (
                              <div className="col-12">
                                <span className="text-muted small d-block mb-1">响应摘要</span>
                                <div className="bg-white p-2 rounded small" style={{ maxHeight: 80, overflow: 'auto', fontSize: 12 }}>
                                  {item.response_summary}
                                </div>
                              </div>
                            )}
                            {item.error_message && (
                              <div className="col-12">
                                <span className="text-muted small d-block mb-1">错误信息</span>
                                <div className="bg-danger bg-opacity-10 p-2 rounded small text-danger" style={{ fontSize: 12 }}>
                                  {item.error_message}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-4">
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => p - 1)}>上一页</button>
              </li>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <li key={p} className={`page-item ${page === p ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                  </li>
                )
              })}
              <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => p + 1)}>下一页</button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  )
}
