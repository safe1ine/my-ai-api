import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { statsApi, StatsOverview, UsagePoint, ModelStat, ApiKeyStat } from '../api'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316']

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

// 根据粒度格式化 X 轴时间标签
function fmtTick(iso: string, granularity: 'day' | 'week' | 'month') {
  const d = new Date(iso + 'Z')  // 后端存储 UTC，加 Z 后按本地时区显示
  if (granularity === 'day') {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 每隔多少个数据点显示一个刻度
const TICK_INTERVAL: Record<string, number> = {
  day: 11,   // 5min × 12 = 1h，显示 ~24 个刻度
  week: 47,  // 30min × 48 = 24h，显示 ~7 个刻度
  month: 11, // 2h × 12 = 24h，显示 ~30 个刻度
}

// ── Overview Card ─────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color, bg,
}: {
  label: string; value: string; sub?: string
  icon: string; color: string; bg: string
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: bg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 20, color }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 3, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────

function ChartTooltipMs({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e293b', borderRadius: 10, padding: '10px 14px',
      border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#cbd5e1' }}>{p.name}</span>
          <span style={{ color: '#fff', fontWeight: 600, marginLeft: 'auto', paddingLeft: 12 }}>
            {fmtMs(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e293b', borderRadius: 10, padding: '10px 14px',
      border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#cbd5e1' }}>{p.name}</span>
          <span style={{ color: '#fff', fontWeight: 600, marginLeft: 'auto', paddingLeft: 12 }}>
            {fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Section Card ──────────────────────────────────────────────────────────

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#d1d5db' }}>
      <i className="bi bi-bar-chart" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />
      <span style={{ fontSize: 14, color: '#9ca3af' }}>{text}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [usage, setUsage] = useState<UsagePoint[]>([])
  const [models, setModels] = useState<ModelStat[]>([])
  const [keyStats, setKeyStats] = useState<ApiKeyStat[]>([])
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([statsApi.overview(), statsApi.byModel(), statsApi.byApiKey()])
      .then(([o, m, k]) => { setOverview(o); setModels(m); setKeyStats(k) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { statsApi.usage(granularity).then(setUsage) }, [granularity])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <div className="spinner-border" style={{ width: 24, height: 24, borderWidth: 2, color: '#6366f1' }} />
      </div>
    )
  }

  const successRate = overview && overview.total_requests > 0
    ? ((overview.success_requests / overview.total_requests) * 100).toFixed(1)
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h4 className="fw-bold mb-1">统计</h4>
        <p className="text-muted mb-0" style={{ fontSize: 14 }}>API 使用情况总览</p>
      </div>

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <StatCard label="总请求数" value={fmtNum(overview?.total_requests ?? 0)}
          sub={`成功 ${fmtNum(overview?.success_requests ?? 0)} / 失败 ${fmtNum(overview?.error_requests ?? 0)}`}
          icon="bi-arrow-repeat" color="#6366f1" bg="#eff0ff" />
        <StatCard label="成功率" value={`${successRate}%`}
          sub={`${overview?.error_requests ?? 0} 次错误`}
          icon="bi-check-circle" color="#10b981" bg="#ecfdf5" />
        <StatCard label="输入 Tokens" value={fmtNum(overview?.total_input_tokens ?? 0)}
          sub={(() => {
            const read = overview?.total_cache_read_tokens ?? 0
            const input = overview?.total_input_tokens ?? 0
            if (!input) return undefined
            const rate = Math.floor(read / input * 1000) / 10
            return `缓存命中率 ${rate}%`
          })()}
          icon="bi-arrow-right-circle" color="#0ea5e9" bg="#f0f9ff" />
        <StatCard label="输出 Tokens" value={fmtNum(overview?.total_output_tokens ?? 0)}
          icon="bi-arrow-left-circle" color="#f59e0b" bg="#fffbeb" />
      </div>

      {/* Trend charts — single card, shared granularity toggle */}
      <Card
        title="趋势"
        action={
          <div style={{ display: 'flex', gap: 4 }}>
            {([['day', '日'], ['week', '周'], ['month', '月']] as const).map(([g, label]) => (
              <button key={g} onClick={() => setGranularity(g)} style={{
                padding: '4px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${granularity === g ? '#6366f1' : '#e5e7eb'}`,
                background: granularity === g ? '#6366f1' : '#fff',
                color: granularity === g ? '#fff' : '#6b7280',
                fontWeight: granularity === g ? 600 : 400,
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        }
      >
        {usage.length === 0 ? <EmptyState text="暂无数据" /> : (() => {
          const tickInterval = TICK_INTERVAL[granularity]
          const xAxisProps = {
            dataKey: 'date',
            tickFormatter: (v: string) => fmtTick(v, granularity),
            tick: { fontSize: 10, fill: '#9ca3af' },
            axisLine: false, tickLine: false,
            interval: tickInterval,
          }
          const successRateData = usage.map(p => ({
            ...p,
            success_rate: p.requests > 0 ? Math.floor(p.success_requests / p.requests * 1000) / 10 : 0,
            error_rate: p.requests > 0 ? Math.ceil((1 - p.success_requests / p.requests) * 1000) / 10 : 0,
          }))
          const subTitle = (label: string) => (
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>{label}</div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                {subTitle('输入 Token')}
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={usage} margin={{ top: 2, right: 4, left: -10, bottom: 0 }} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis {...xAxisProps} />
                    <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="input_tokens" name="输入" fill="#6366f1" opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                {subTitle('输出 Token')}
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={usage} margin={{ top: 2, right: 4, left: -10, bottom: 0 }} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis {...xAxisProps} />
                    <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="output_tokens" name="输出" fill="#10b981" opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                {subTitle('请求数')}
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={usage} margin={{ top: 2, right: 4, left: -10, bottom: 0 }} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis {...xAxisProps} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="requests" name="请求数" fill="#0ea5e9" opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                {subTitle('成功率')}
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={successRateData} margin={{ top: 2, right: 4, left: -10, bottom: 0 }} barCategoryGap="10%" stackOffset="none">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis {...xAxisProps} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="success_rate" name="成功率" fill="#10b981" opacity={0.85} stackId="s" />
                    <Bar dataKey="error_rate" name="失败率" fill="#ef4444" opacity={0.85} stackId="s" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                {subTitle('首字延迟（流式）')}
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={usage} margin={{ top: 2, right: 4, left: -10, bottom: 0 }} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis {...xAxisProps} />
                    <YAxis tickFormatter={fmtMs} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltipMs />} />
                    <Bar dataKey="avg_first_token_latency_ms" name="首字延迟" fill="#8b5cf6" opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                {subTitle('总响应时间')}
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={usage} margin={{ top: 2, right: 4, left: -10, bottom: 0 }} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis {...xAxisProps} />
                    <YAxis tickFormatter={fmtMs} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltipMs />} />
                    <Bar dataKey="avg_latency_ms" name="响应时间" fill="#f97316" opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}
      </Card>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Model distribution */}
        <Card title="模型分布">
          {models.length === 0 ? <EmptyState text="暂无数据" /> : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={models} dataKey="total_tokens" cx="50%" cy="50%"
                      innerRadius={40} outerRadius={65} strokeWidth={2} stroke="#fff">
                      {models.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtNum(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {models.slice(0, 6).map((m, i) => (
                  <div key={m.model} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.model}>
                      {m.model}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtNum(m.total_tokens)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Token ranking by key */}
        <Card title="Token 消耗排行">
          {keyStats.length === 0 ? <EmptyState text="暂无数据" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {keyStats.slice(0, 6).map((k, i) => {
                const maxT = Math.max(...keyStats.map(x => x.total_tokens), 1)
                const pct = (k.total_tokens / maxT) * 100
                return (
                  <div key={k.api_key_prefix}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 700,
                          background: i === 0 ? '#fef3c7' : '#f3f4f6',
                          color: i === 0 ? '#d97706' : '#9ca3af',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ fontWeight: 500, color: '#374151' }}>{k.api_key_prefix}</span>
                      </span>
                      <span style={{ color: '#6b7280', fontSize: 12 }}>{fmtNum(k.total_tokens)}</span>
                    </div>
                    <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${pct}%`,
                        background: i === 0 ? '#6366f1' : '#e0e7ff',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Model requests bar */}
        <Card title="模型请求次数">
          {models.length === 0 ? <EmptyState text="暂无数据" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {models.slice(0, 6).map((m, i) => {
                const maxR = Math.max(...models.map(x => x.requests), 1)
                const pct = (m.requests / maxR) * 100
                return (
                  <div key={m.model}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={m.model}>
                        {m.model}
                      </span>
                      <span style={{ color: '#6b7280', flexShrink: 0 }}>{m.requests.toLocaleString()} 次</span>
                    </div>
                    <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${pct}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                        opacity: 0.75,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Request success/error */}
        <Card title="请求状态分布">
          {!overview || overview.total_requests === 0 ? <EmptyState text="暂无数据" /> : (() => {
            const data = [
              { name: '成功', value: overview.success_requests, color: '#10b981', bg: '#ecfdf5' },
              { name: '失败', value: overview.error_requests, color: '#ef4444', bg: '#fef2f2' },
            ]
            return (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flexShrink: 0 }}>
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={data} dataKey="value" cx="50%" cy="50%"
                        innerRadius={40} outerRadius={65} strokeWidth={2} stroke="#fff">
                        {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.map(d => (
                    <div key={d.name} style={{ background: d.bg, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 12, color: d.color, fontWeight: 600, marginBottom: 2 }}>{d.name}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: d.color }}>{d.value.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: d.color, opacity: 0.7 }}>
                        {overview.total_requests > 0 ? ((d.value / overview.total_requests) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </Card>

      </div>
    </div>
  )
}
