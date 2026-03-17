import { useEffect, useState } from 'react'
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
      <h4 className="mb-4 fw-bold">调用记录</h4>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small mb-1">状态</label>
              <div className="btn-group">
                {[
                  { val: '', label: '全部' },
                  { val: 'success', label: '成功' },
                  { val: 'error', label: '失败' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    className={`btn btn-sm btn-outline-secondary ${statusFilter === opt.val ? 'active' : ''}`}
                    onClick={() => handleStatus(opt.val)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-sm-4">
              <label className="form-label small mb-1">模型搜索</label>
              <div className="input-group input-group-sm">
                <input
                  className="form-control"
                  placeholder="输入模型名关键词..."
                  value={modelInput}
                  onChange={e => setModelInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn btn-primary" onClick={handleSearch}>
                  <i className="bi bi-search" />
                </button>
              </div>
            </div>
            <div className="col-auto ms-auto">
              <small className="text-muted">共 {total} 条记录</small>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="d-flex justify-content-center p-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted p-5">暂无数据</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>时间</th>
                    <th>状态</th>
                    <th>模型</th>
                    <th>上游</th>
                    <th>API Key</th>
                    <th className="text-end">Input</th>
                    <th className="text-end">Output</th>
                    <th className="text-end">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <>
                      <tr
                        key={item.id}
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(item.created_at)}</td>
                        <td>
                          <span className={`badge bg-${item.status === 'success' ? 'success' : 'danger'}`}>
                            {item.status === 'success' ? '成功' : '失败'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}><code>{item.model}</code></td>
                        <td style={{ fontSize: 12 }}>{item.provider_name ?? '-'}</td>
                        <td style={{ fontSize: 12 }}><code>{item.api_key_prefix}</code></td>
                        <td className="text-end" style={{ fontSize: 12 }}>{item.input_tokens.toLocaleString()}</td>
                        <td className="text-end" style={{ fontSize: 12 }}>{item.output_tokens.toLocaleString()}</td>
                        <td className="text-end" style={{ fontSize: 12 }}>{item.latency_ms} ms</td>
                      </tr>
                      {expandedId === item.id && (
                        <tr>
                          <td colSpan={8} className="bg-light p-3">
                            <div className="row g-3">
                              {item.client_ip && (
                                <div className="col-md-6">
                                  <small className="text-muted">客户端IP</small>
                                  <div><code>{item.client_ip}</code></div>
                                </div>
                              )}
                              {item.first_token_latency_ms > 0 && (
                                <div className="col-md-6">
                                  <small className="text-muted">首token耗时</small>
                                  <div>{item.first_token_latency_ms} ms</div>
                                </div>
                              )}
                              {item.request_summary && (
                                <div className="col-12">
                                  <small className="text-muted">请求摘要</small>
                                  <div className="bg-white p-2 rounded small" style={{ maxHeight: 100, overflow: 'auto' }}>
                                    {item.request_summary}
                                  </div>
                                </div>
                              )}
                              {item.response_summary && (
                                <div className="col-12">
                                  <small className="text-muted">响应摘要</small>
                                  <div className="bg-white p-2 rounded small" style={{ maxHeight: 100, overflow: 'auto' }}>
                                    {item.response_summary}
                                  </div>
                                </div>
                              )}
                              {item.error_message && (
                                <div className="col-12">
                                  <small className="text-muted">错误信息</small>
                                  <div className="bg-danger bg-opacity-10 p-2 rounded small text-danger">
                                    {item.error_message}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-3 d-flex justify-content-center">
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
      )}
    </div>
  )
}
