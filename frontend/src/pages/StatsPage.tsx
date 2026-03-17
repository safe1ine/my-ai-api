import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
} from 'recharts'
import { statsApi, StatsOverview, UsagePoint, ModelStat, ApiKeyStat } from '../api'

const COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14']

export default function StatsPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [usage, setUsage] = useState<UsagePoint[]>([])
  const [models, setModels] = useState<ModelStat[]>([])
  const [keyStats, setKeyStats] = useState<ApiKeyStat[]>([])
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      statsApi.overview(),
      statsApi.byModel(),
      statsApi.byApiKey(),
    ]).then(([o, m, k]) => {
      setOverview(o)
      setModels(m)
      setKeyStats(k)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    statsApi.usage(granularity).then(setUsage)
  }, [granularity])

  const fmtNum = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: 300 }}>
        <div className="spinner-border text-primary" />
      </div>
    )
  }

  return (
    <div>
      <h4 className="mb-4 fw-bold">统计</h4>

      {/* Overview Cards */}
      <div className="row g-3 mb-4">
        {[
          { label: '总请求数', value: overview?.total_requests ?? 0, icon: 'bi-arrow-repeat', color: 'primary' },
          { label: 'Input Tokens', value: overview?.total_input_tokens ?? 0, icon: 'bi-arrow-right-circle', color: 'success' },
          { label: 'Output Tokens', value: overview?.total_output_tokens ?? 0, icon: 'bi-arrow-left-circle', color: 'warning' },
          { label: 'Total Tokens', value: overview?.total_tokens ?? 0, icon: 'bi-lightning', color: 'danger' },
        ].map(card => (
          <div key={card.label} className="col-6 col-xl-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex align-items-center gap-3">
                <div
                  className={`rounded-3 d-flex align-items-center justify-content-center bg-${card.color} bg-opacity-10`}
                  style={{ width: 48, height: 48, flexShrink: 0 }}
                >
                  <i className={`bi ${card.icon} text-${card.color}`} style={{ fontSize: 20 }} />
                </div>
                <div>
                  <div className="text-muted small">{card.label}</div>
                  <div className="fw-bold fs-5">{fmtNum(card.value)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Token Trend */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0 fw-semibold">Token 趋势</h6>
            <div className="btn-group btn-group-sm">
              {(['day', 'week', 'month'] as const).map(g => (
                <button
                  key={g}
                  className={`btn btn-outline-secondary ${granularity === g ? 'active' : ''}`}
                  onClick={() => setGranularity(g)}
                >
                  {{ day: '日', week: '周', month: '月' }[g]}
                </button>
              ))}
            </div>
          </div>
          {usage.length === 0 ? (
            <div className="text-center text-muted py-5">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={usage} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtNum} />
                <Tooltip formatter={(v: number) => fmtNum(v)} />
                <Legend />
                <Line type="monotone" dataKey="input_tokens" name="Input" stroke="#0d6efd" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="output_tokens" name="Output" stroke="#198754" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="row g-4">
        {/* Model Distribution */}
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h6 className="mb-3 fw-semibold">模型分布</h6>
              {models.length === 0 ? (
                <div className="text-center text-muted py-5">暂无数据</div>
              ) : (
                <div className="d-flex align-items-center gap-3">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie
                        data={models}
                        dataKey="total_tokens"
                        nameKey="model"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {models.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <PieTooltip formatter={(v: number) => fmtNum(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-grow-1" style={{ fontSize: 12 }}>
                    {models.map((m, i) => (
                      <div key={m.model} className="d-flex align-items-center gap-2 mb-1">
                        <span
                          className="rounded-circle d-inline-block"
                          style={{ width: 8, height: 8, background: COLORS[i % COLORS.length], flexShrink: 0 }}
                        />
                        <span className="text-truncate" title={m.model}>{m.model}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* API Key Ranking */}
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h6 className="mb-3 fw-semibold">API Key 排行</h6>
              {keyStats.length === 0 ? (
                <div className="text-center text-muted py-5">暂无数据</div>
              ) : (
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>API Key</th>
                      <th className="text-end">请求数</th>
                      <th className="text-end">Total Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyStats.map((k, i) => (
                      <tr key={k.api_key_prefix}>
                        <td className="text-muted">{i + 1}</td>
                        <td><code>{k.api_key_prefix}</code></td>
                        <td className="text-end">{k.requests.toLocaleString()}</td>
                        <td className="text-end">{fmtNum(k.total_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
