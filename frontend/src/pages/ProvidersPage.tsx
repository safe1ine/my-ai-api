import { useEffect, useRef, useState } from 'react'
import { providersApi, ProviderOut, ProviderCreate, ProviderTokenStats } from '../api'

// id → 已解密的完整 key（用于行内展示）
type RevealedKeys = Record<number, string | 'loading'>

// ── 列定义 ──────────────────────────────────────────────────────────────────

type ColKey = 'priority' | 'name' | 'type' | 'apiKey' | 'baseUrl' | 'proxy' | 'health' | 'status' | 'createdAt' | 'tokenStats'

interface ColDef { key: ColKey; label: string; defaultOn: boolean }

type ProviderTypeTab = 'openai' | 'anthropic'

const COL_DEFS: ColDef[] = [
  { key: 'priority',  label: '优先级', defaultOn: true  },
  { key: 'name',      label: '名称',   defaultOn: true  },
  { key: 'type',      label: '类型',   defaultOn: true  },
  { key: 'apiKey',    label: 'API Key', defaultOn: false },
  { key: 'baseUrl',   label: 'Base URL', defaultOn: false },
  { key: 'proxy',     label: '代理',   defaultOn: false },
  { key: 'health',    label: '探活',   defaultOn: true  },
  { key: 'tokenStats', label: 'Token 用量', defaultOn: true },
  { key: 'status',    label: '状态',   defaultOn: true  },
  { key: 'createdAt', label: '创建时间', defaultOn: true },
]

const DEFAULT_VISIBLE = new Set<ColKey>(COL_DEFS.filter(c => c.defaultOn).map(c => c.key))
const LS_KEY = 'providers_visible_cols'

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

function ColPicker({ visible, onChange }: { visible: Set<ColKey>; onChange: (next: Set<ColKey>) => void }) {
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
      if (next.size <= 2) return
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(next)
  }

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
        <span style={{ fontSize: 11, background: '#e8f0fe', color: '#1a73e8', borderRadius: 10, padding: '0 5px', fontWeight: 600, lineHeight: '18px' }}>
          {visible.size}
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
          background: '#fff', border: '1px solid #e8eaed', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', padding: '8px 0', minWidth: 160,
        }}>
          <div style={{ padding: '4px 14px 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            显示列
          </div>
          {COL_DEFS.map(col => {
            const checked = visible.has(col.key)
            return (
              <label key={col.key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#3c4043',
                background: checked ? '#e8f0fe' : 'transparent', transition: 'background 0.1s',
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${checked ? '#1a73e8' : '#d1d5db'}`,
                  background: checked ? '#1a73e8' : '#fff',
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
            style={{ width: '100%', textAlign: 'left', padding: '5px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af' }}
          >
            <i className="bi bi-arrow-counterclockwise" style={{ marginRight: 5 }} />
            恢复默认
          </button>
        </div>
      )}
    </div>
  )
}

const emptyForm: ProviderCreate & { id?: number } = {
  name: '',
  group_name: '',
  type: 'openai',
  api_key: '',
  base_url: '',
  proxy_url: '',
  is_active: true,
  priority: 5,
  skip_health_check: false,
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function normalizeGroupName(groupName: string | null | undefined): string {
  return groupName?.trim() || '未分组'
}

function compareProvidersByPriority(a: ProviderOut, b: ProviderOut): number {
  const priorityCmp = (a.priority ?? 5) - (b.priority ?? 5)
  if (priorityCmp !== 0) return priorityCmp
  return a.name.localeCompare(b.name, 'zh-CN')
}

const TYPE_CONFIG = {
  openai: { label: 'OpenAI', color: '#10a37f', bg: '#f0fdf8', icon: 'bi-stars' },
  anthropic: { label: 'Anthropic', color: '#d97706', bg: '#fffbeb', icon: 'bi-cpu' },
}

function IconBtn({
  icon, title, onClick, hoverColor = '#6b7280',
}: { icon: string; title: string; onClick: () => void; hoverColor?: string }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: 'none', background: hover ? `${hoverColor}15` : 'transparent',
        color: hover ? hoverColor : '#9ca3af',
        padding: '6px 8px', borderRadius: 7, cursor: 'pointer',
        fontSize: 14, transition: 'all 0.15s',
      }}
    >
      <i className={`bi ${icon}`} />
    </button>
  )
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' | 'info' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProviderOut | null>(null)
  const [modelsModal, setModelsModal] = useState<{ name: string; models: string[]; loading: boolean } | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [testing, setTesting] = useState<number | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<RevealedKeys>({})
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(loadVisibleCols)
  const [tokenStats, setTokenStats] = useState<Record<number, ProviderTokenStats>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [groupSavingKey, setGroupSavingKey] = useState<string | null>(null)
  const [priorityDialog, setPriorityDialog] = useState<{ key: string; providers: ProviderOut[]; value: number } | null>(null)
  const [activeTypeTab, setActiveTypeTab] = useState<ProviderTypeTab>('openai')
  const modalRef = useRef<HTMLDivElement>(null)

  const show = (k: ColKey) => visibleCols.has(k)
  const updateCols = (next: Set<ColKey>) => { saveVisibleCols(next); setVisibleCols(next) }

  const load = () => {
    setLoading(true)
    Promise.all([
      providersApi.list(),
      providersApi.tokenStats(),
    ]).then(([providerList, stats]) => {
      setProviders(providerList)
      const map: Record<number, ProviderTokenStats> = {}
      for (const s of stats) map[s.provider_id] = s
      setTokenStats(map)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const hasOpenAI = providers.some(p => p.type === 'openai')
    const hasAnthropic = providers.some(p => p.type === 'anthropic')
    if (activeTypeTab === 'openai' && !hasOpenAI && hasAnthropic) setActiveTypeTab('anthropic')
    if (activeTypeTab === 'anthropic' && !hasAnthropic && hasOpenAI) setActiveTypeTab('openai')
  }, [activeTypeTab, providers])

  const showToast = (msg: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const trimmedGroupName = form.group_name?.trim() || ''
  const formGroupProviders = trimmedGroupName
    ? providers.filter(p =>
      p.type === form.type &&
      normalizeGroupName(p.group_name) === normalizeGroupName(trimmedGroupName)
      )
    : []
  const groupedFormMode = Boolean(trimmedGroupName) && (formMode === 'edit' || formGroupProviders.length > 0)
  const existingGroupLeader = formGroupProviders.find(p => p.id !== form.id) ?? formGroupProviders[0] ?? null

  const openCreate = () => {
    setForm({ ...emptyForm })
    setFormMode('create')
    openModal()
  }

  const openEdit = async (p: ProviderOut) => {
    setForm({ 
      id: p.id, 
      name: p.name, 
      group_name: p.group_name ?? '',
      type: p.type, 
      api_key: '', 
      base_url: p.base_url ?? '', 
      proxy_url: p.proxy_url ?? '', 
      is_active: p.is_active, 
      priority: p.priority ?? 5,
      skip_health_check: p.skip_health_check ?? false,
    })
    setFormMode('edit')
    openModal()
    try {
      const detail = await providersApi.get(p.id)
      setForm(f => ({ ...f, api_key: detail.api_key }))
    } catch {}
  }

  const openDuplicate = async (p: ProviderOut) => {
    setForm({
      ...emptyForm,
      name: `${p.name} Copy`,
      group_name: p.group_name ?? '',
      type: p.type,
      api_key: '',
      base_url: p.base_url ?? '',
      proxy_url: p.proxy_url ?? '',
      is_active: p.is_active,
      priority: p.priority ?? 5,
      skip_health_check: p.skip_health_check ?? false,
    })
    setFormMode('create')
    openModal()
    try {
      const detail = await providersApi.get(p.id)
      setForm(f => ({ ...f, api_key: detail.api_key }))
    } catch {
      showToast('复制 upstream 时获取 API Key 失败', 'danger')
    }
  }

  const openModal = () => {
    const el = document.getElementById('providerModal')
    if (el) {
      // @ts-ignore
      window.bootstrap?.Modal.getOrCreateInstance(el)?.show()
    }
  }

  const closeModal = () => {
    const el = document.getElementById('providerModal')
    if (el) {
      // @ts-ignore
      window.bootstrap?.Modal.getInstance(el)?.hide()
    }
  }

  const handleSubmit = async () => {
    if (!form.name || (!form.api_key && formMode === 'create')) {
      showToast('请填写必填字段', 'danger')
      return
    }
    setSaving(true)
    try {
      if (formMode === 'create') {
        await providersApi.create({ 
          name: form.name, 
          group_name: form.group_name?.trim() || undefined,
          type: form.type, 
          api_key: form.api_key, 
          base_url: form.base_url || undefined, 
          proxy_url: form.proxy_url || undefined, 
          is_active: existingGroupLeader ? existingGroupLeader.is_active : form.is_active, 
          priority: existingGroupLeader ? existingGroupLeader.priority : form.priority,
          skip_health_check: form.skip_health_check,
        })
        showToast('Upstream 已创建')
      } else {
        const body: Record<string, unknown> = { 
          name: form.name, 
          group_name: form.group_name?.trim() || null,
          type: form.type, 
          is_active: existingGroupLeader ? existingGroupLeader.is_active : form.is_active, 
          priority: existingGroupLeader ? existingGroupLeader.priority : form.priority,
          skip_health_check: form.skip_health_check,
        }
        if (form.api_key) body.api_key = form.api_key
        if (form.base_url !== undefined) body.base_url = form.base_url
        body.proxy_url = form.proxy_url || null
        await providersApi.update(form.id!, body)
        showToast('Upstream 已更新')
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
      showToast('已删除')
      setDeleteTarget(null)
      load()
    } catch {
      showToast('删除失败', 'danger')
    }
  }

  const handleTest = async (p: ProviderOut) => {
    setTesting(p.id)
    try {
      const res = await providersApi.test(p.id)
      const msg = res.success ? `连接成功 ${res.latency_ms}ms` : res.message
      showToast(msg, res.success ? 'success' : 'danger')
      load()
    } catch {
      showToast('连接测试失败', 'danger')
    } finally {
      setTesting(null)
    }
  }

  const handleModels = async (p: ProviderOut) => {
    setModelsModal({ name: p.name, models: [], loading: true })
    const el = document.getElementById('modelsModal')
    if (el) {
      // @ts-ignore
      window.bootstrap?.Modal.getOrCreateInstance(el)?.show()
    }
    try {
      const res = await providersApi.models(p.id)
      setModelsModal({ name: p.name, models: res.models, loading: false })
    } catch {
      showToast('获取模型列表失败', 'danger')
      setModelsModal(null)
    }
  }

  const handleToggle = async (p: ProviderOut) => {
    try {
      await providersApi.update(p.id, { is_active: !p.is_active })
      load()
    } catch {
      showToast('操作失败', 'danger')
    }
  }

  const handleRevealKey = async (p: ProviderOut) => {
    if (revealedKeys[p.id]) {
      setRevealedKeys(k => { const n = { ...k }; delete n[p.id]; return n })
      return
    }
    setRevealedKeys(k => ({ ...k, [p.id]: 'loading' }))
    try {
      const detail = await providersApi.get(p.id)
      setRevealedKeys(k => ({ ...k, [p.id]: detail.api_key }))
    } catch {
      setRevealedKeys(k => { const n = { ...k }; delete n[p.id]; return n })
      showToast('获取 API Key 失败', 'danger')
    }
  }

  const toggleGroupExpanded = (groupKey: string) => {
    setExpandedGroups(s => ({ ...s, [groupKey]: !s[groupKey] }))
  }

  const handleGroupToggle = async (groupKey: string, groupProviders: ProviderOut[]) => {
    const nextValue = !groupProviders.every(p => p.is_active)
    setGroupSavingKey(groupKey)
    try {
      await Promise.all(groupProviders.map(p => providersApi.update(p.id, { is_active: nextValue })))
      showToast(nextValue ? '分组已启用' : '分组已禁用')
      load()
    } catch {
      showToast('分组状态更新失败', 'danger')
    } finally {
      setGroupSavingKey(null)
    }
  }

  const handleGroupPriorityChange = async (groupKey: string, groupProviders: ProviderOut[], priority: number) => {
    setGroupSavingKey(groupKey)
    try {
      await Promise.all(groupProviders.map(p => providersApi.update(p.id, { priority })))
      showToast(`分组优先级已更新为 ${priority}`)
      load()
    } catch {
      showToast('分组优先级更新失败', 'danger')
    } finally {
      setGroupSavingKey(null)
    }
  }

  const openGroupPriorityDialog = (groupKey: string, groupProviders: ProviderOut[], priority: number) => {
    setPriorityDialog({ key: groupKey, providers: groupProviders, value: priority })
  }

  const submitGroupPriorityDialog = async () => {
    if (!priorityDialog) return
    await handleGroupPriorityChange(priorityDialog.key, priorityDialog.providers, priorityDialog.value)
    setPriorityDialog(null)
  }

  const fmtDate = (iso: string) => new Date(iso + 'Z').toLocaleString('zh-CN', { hour12: false })

  const HealthBadge = ({ p }: { p: ProviderOut }) => {
    if (p.skip_health_check) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#d97706' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
          已跳过检查
        </span>
      )
    }
    if (p.last_check_success === null || p.last_check_at === null) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9ca3af' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
          未探活
        </span>
      )
    }
    if (p.last_check_success) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          正常 {p.last_check_latency_ms}ms
        </span>
      )
    }
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#dc2626', maxWidth: 160 }}
        title={p.last_check_error ?? undefined}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.last_check_error ? p.last_check_error.slice(0, 40) : '失败'}
        </span>
      </span>
    )
  }

  const toastColors = {
    success: { bg: '#dcfce7', border: '#86efac', color: '#166534', icon: 'bi-check-circle-fill' },
    danger: { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', icon: 'bi-exclamation-circle-fill' },
    info: { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af', icon: 'bi-info-circle-fill' },
  }

  const typeCounts = {
    openai: providers.filter(p => p.type === 'openai').length,
    anthropic: providers.filter(p => p.type === 'anthropic').length,
  }

  const renderProviderRow = (p: ProviderOut) => (
    <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
      {show('priority') && (
        <td style={{ padding: '14px 20px', textAlign: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 8,
            background: '#f8f9fa', color: '#3c4043',
            fontSize: 13, fontWeight: 700,
          }}>
            {p.priority ?? 5}
          </span>
        </td>
      )}
      {show('name') && (
        <td style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="fw-semibold" style={{ fontSize: 14 }}>{p.name}</span>
            {p.group_name && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                width: 'fit-content', fontSize: 12, color: '#6b7280',
                background: '#f3f4f6', borderRadius: 999, padding: '2px 8px',
              }}>
                <i className="bi bi-collection" style={{ fontSize: 11 }} />
                {p.group_name}
              </span>
            )}
          </div>
        </td>
      )}
      {show('apiKey') && (
        <td style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{
              fontSize: 12, background: '#f8f9fa', color: '#3c4043',
              padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace',
              maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {revealedKeys[p.id] === 'loading'
                ? '加载中...'
                : revealedKeys[p.id]
                  ? revealedKeys[p.id]
                  : `${p.api_key_prefix}···`}
            </code>
            <button
              title={revealedKeys[p.id] ? '隐藏' : '查看完整 Key'}
              onClick={() => handleRevealKey(p)}
              style={{
                border: 'none', background: 'none', padding: '2px 4px',
                cursor: 'pointer', color: '#9ca3af', fontSize: 13, lineHeight: 1, flexShrink: 0,
              }}
            >
              <i className={`bi ${revealedKeys[p.id] && revealedKeys[p.id] !== 'loading' ? 'bi-eye-slash' : 'bi-eye'}`} />
            </button>
          </div>
        </td>
      )}
      {show('baseUrl') && (
        <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280', maxWidth: 200 }}>
          {p.base_url
            ? <span style={{ wordBreak: 'break-all' }}>{p.base_url}</span>
            : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>默认</span>
          }
        </td>
      )}
      {show('proxy') && (
        <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280', maxWidth: 180 }}>
          {p.proxy_url
            ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#fef3c7', color: '#92400e',
                borderRadius: 6, padding: '2px 8px', fontSize: 12, wordBreak: 'break-all',
              }}>
                <i className="bi bi-hdd-network" style={{ fontSize: 11, flexShrink: 0 }} />
                {p.proxy_url}
              </span>
            )
            : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>直连</span>
          }
        </td>
      )}
      {show('health') && (
        <td style={{ padding: '14px 20px' }}>
          <HealthBadge p={p} />
        </td>
      )}
      {show('tokenStats') && (
        <td style={{ padding: '14px 20px' }}>
          {(() => {
            const s = tokenStats[p.id]
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
      )}
      {show('status') && (
        <td style={{ padding: '14px 20px' }}>
          <div
            onClick={() => { if (!p.group_name) handleToggle(p) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 20, cursor: p.group_name ? 'default' : 'pointer',
              background: p.is_active ? '#dcfce7' : '#f3f4f6',
              color: p.is_active ? '#16a34a' : '#6b7280',
              fontSize: 12, fontWeight: 500, userSelect: 'none', transition: 'all 0.2s',
            }}
            title={p.group_name ? '已分组，请在分组头统一启用/禁用' : undefined}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.is_active ? '#22c55e' : '#d1d5db' }} />
            {p.is_active ? '已启用' : '已禁用'}
          </div>
        </td>
      )}
      {show('createdAt') && (
        <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>
          {fmtDate(p.created_at)}
        </td>
      )}
      <td style={{ padding: '14px 20px' }}>
        <div className="d-flex gap-1">
          <IconBtn icon="bi-pencil" title="编辑" onClick={() => openEdit(p)} hoverColor="#1a73e8" />
          <IconBtn icon="bi-copy" title="复制" onClick={() => openDuplicate(p)} hoverColor="#7c3aed" />
          <IconBtn
            icon={testing === p.id ? 'bi-arrow-repeat' : 'bi-wifi'}
            title="测试连通性"
            onClick={() => handleTest(p)}
            hoverColor="#0ea5e9"
          />
          <IconBtn icon="bi-grid" title="查看模型列表" onClick={() => handleModels(p)} hoverColor="#10b981" />
          <IconBtn icon="bi-trash" title="删除" onClick={() => setDeleteTarget(p)} hoverColor="#ef4444" />
        </div>
      </td>
    </tr>
  )

  const renderTypeSection = (type: 'openai' | 'anthropic') => {
    const typeProviders = providers
      .filter(p => p.type === type)
      .sort(compareProvidersByPriority)
    if (typeProviders.length === 0) return null

    const tc = TYPE_CONFIG[type]
    const grouped = new Map<string, ProviderOut[]>()
    const ungrouped: ProviderOut[] = []
    for (const provider of typeProviders) {
      if (provider.group_name?.trim()) {
        const groupName = normalizeGroupName(provider.group_name)
        if (!grouped.has(groupName)) grouped.set(groupName, [])
        grouped.get(groupName)!.push(provider)
      } else {
        ungrouped.push(provider)
      }
    }
    const sections = [
      ...[...grouped.entries()].map(([groupName, groupProviders]) => ({
        key: `${type}:group:${groupName}`,
        title: groupName,
        providers: [...groupProviders].sort(compareProvidersByPriority),
        grouped: true,
      })),
      ...ungrouped.map(provider => ({
        key: `${type}:single:${provider.id}`,
        title: provider.name,
        providers: [provider],
        grouped: false,
      })),
    ].sort((a, b) => {
      const priorityCmp = (a.providers[0]?.priority ?? 5) - (b.providers[0]?.priority ?? 5)
      if (priorityCmp !== 0) return priorityCmp
      if (a.grouped !== b.grouped) return a.grouped ? -1 : 1
      return a.title.localeCompare(b.title, 'zh-CN')
    })

    return (
      <div key={type} style={{ border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          background: type === 'openai'
            ? 'linear-gradient(135deg, #f0fdf8 0%, #ecfdf5 100%)'
            : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          padding: '14px 20px',
          borderBottom: type === 'openai' ? '1px solid #d1fae5' : '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: tc.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <i className={`bi ${tc.icon}`} style={{ color: '#fff', fontSize: 15 }} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ fontSize: 15, color: type === 'openai' ? '#065f46' : '#92400e' }}>{tc.label}</h5>
              <p className="mb-0 text-muted" style={{ fontSize: 12 }}>
                {type === 'openai' ? 'OpenAI 及兼容接口供应商' : 'Anthropic Claude 系列供应商'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge rounded-pill" style={{ background: '#fff', color: tc.color, fontSize: 12, padding: '5px 12px', border: `1px solid ${tc.color}33` }}>
              {grouped.size} 组
            </span>
            <span className="badge rounded-pill" style={{ background: tc.color, color: '#fff', fontSize: 12, padding: '5px 12px' }}>
              {typeProviders.length} 个
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sections.map((section, index) => {
            const groupProviders = section.providers
            const singleProvider = section.grouped ? null : groupProviders[0] ?? null
            const groupPriority = groupProviders[0]?.priority ?? 5
            const allActive = groupProviders.every(p => p.is_active)
            const collapsed = !expandedGroups[section.key]
            const busy = groupSavingKey === section.key
            const groupTotalInput = groupProviders.reduce((sum, p) => sum + (tokenStats[p.id]?.total_input_tokens ?? 0), 0)
            const groupTotalOutput = groupProviders.reduce((sum, p) => sum + (tokenStats[p.id]?.total_output_tokens ?? 0), 0)
            const groupTodayInput = groupProviders.reduce((sum, p) => sum + (tokenStats[p.id]?.today_input_tokens ?? 0), 0)
            const groupTodayOutput = groupProviders.reduce((sum, p) => sum + (tokenStats[p.id]?.today_output_tokens ?? 0), 0)
            return (
            <div key={section.key} style={{ borderTop: index === 0 ? 'none' : '1px solid #eef2f7' }}>
              <div style={{
                padding: '10px 20px',
                background: '#fafbfc',
                borderBottom: '1px solid #eef2f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {section.grouped ? (
                    <div
                      onClick={() => !busy && openGroupPriorityDialog(section.key, groupProviders, groupPriority)}
                      title={busy ? '处理中...' : '点击修改分组优先级'}
                      style={{ cursor: busy ? 'not-allowed' : 'pointer' }}
                    >
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: 8,
                        background: '#f8f9fa', color: '#3c4043',
                        fontSize: 13, fontWeight: 700,
                        border: '1px solid #e5e7eb',
                        cursor: busy ? 'not-allowed' : 'pointer',
                      }}>
                        {groupPriority}
                      </span>
                    </div>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: 8,
                      background: '#f8f9fa', color: '#3c4043',
                      fontSize: 13, fontWeight: 700,
                      border: '1px solid #e5e7eb',
                    }}>
                      {groupPriority}
                    </span>
                  )}
                  <button
                    onClick={() => toggleGroupExpanded(section.key)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
                  >
                    <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-down'}`} style={{ fontSize: 12 }} />
                  </button>
                  <i className={`bi ${section.grouped ? 'bi-collection' : 'bi-box'}`} style={{ color: '#6b7280', fontSize: 13 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{section.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <div
                      onClick={() => {
                        if (section.grouped) {
                          if (!busy) handleGroupToggle(section.key, groupProviders)
                        } else if (singleProvider) {
                          handleToggle(singleProvider)
                        }
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 999,
                        background: allActive ? '#dcfce7' : '#f3f4f6',
                        color: allActive ? '#16a34a' : '#6b7280',
                        fontWeight: 600,
                        cursor: section.grouped && busy ? 'not-allowed' : 'pointer',
                      }}
                      title={
                        section.grouped
                          ? (busy ? '处理中...' : (allActive ? '点击禁用整组' : '点击启用整组'))
                          : (allActive ? '点击禁用' : '点击启用')
                      }
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: allActive ? '#22c55e' : '#d1d5db' }} />
                      {section.grouped && busy ? '处理中...' : (allActive ? '已启用' : '已禁用')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: '#6b7280', display: 'inline-block', width: 28 }}>总计</span>
                      <span style={{ color: '#2563eb', fontWeight: 600, display: 'inline-block', width: 52, textAlign: 'right' }} title={`输入 ${groupTotalInput.toLocaleString()}`}>
                        <i className="bi bi-arrow-up-short" style={{ fontSize: 11 }} />{fmtTokens(groupTotalInput)}
                      </span>
                      <span style={{ color: '#16a34a', fontWeight: 600, display: 'inline-block', width: 52, textAlign: 'right' }} title={`输出 ${groupTotalOutput.toLocaleString()}`}>
                        <i className="bi bi-arrow-down-short" style={{ fontSize: 11 }} />{fmtTokens(groupTotalOutput)}
                      </span>
                      <span style={{ color: '#d1d5db', margin: '0 2px' }}>|</span>
                      <span style={{ color: '#9ca3af', display: 'inline-block', width: 28 }}>今日</span>
                      <span style={{ color: '#2563eb', fontWeight: 600, display: 'inline-block', width: 52, textAlign: 'right' }} title={`输入 ${groupTodayInput.toLocaleString()}`}>
                        <i className="bi bi-arrow-up-short" style={{ fontSize: 11 }} />{fmtTokens(groupTodayInput)}
                      </span>
                      <span style={{ color: '#16a34a', fontWeight: 600, display: 'inline-block', width: 52, textAlign: 'right' }} title={`输出 ${groupTodayOutput.toLocaleString()}`}>
                        <i className="bi bi-arrow-down-short" style={{ fontSize: 11 }} />{fmtTokens(groupTodayOutput)}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{groupProviders.length} 个上游</span>
                </div>
              </div>
              {!collapsed && (
              <div style={{ overflowX: 'auto' }}>
                <table className="table table-hover mb-0 align-middle" style={{ minWidth: 860 }}>
                  <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e8eaed' }}>
                    <tr>
                      {COL_DEFS.filter(c => visibleCols.has(c.key) && c.key !== 'type').map(c => (
                        <th key={c.key} style={{ padding: '12px 20px', fontWeight: 500, fontSize: 13, color: '#5f6368', border: 0 }}>{c.label}</th>
                      ))}
                      <th style={{ padding: '12px 20px', fontWeight: 500, fontSize: 13, color: '#5f6368', border: 0 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupProviders.map(renderProviderRow)}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )})}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (() => {
        const c = toastColors[toast.type]
        return (
          <div style={{
            position: 'fixed', top: 24, right: 24, zIndex: 9999,
            minWidth: 240, maxWidth: 360,
            background: c.bg, border: `1px solid ${c.border}`, color: c.color,
            borderRadius: 10, padding: '10px 16px', fontSize: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <i className={`bi ${c.icon}`} />
            {toast.msg}
          </div>
        )
      })()}

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <h4 style={{ fontSize: 22, fontWeight: 400, color: '#202124', margin: 0 }}>Upstream</h4>
            <p style={{ fontSize: 14, color: '#5f6368', margin: '4px 0 0' }}>按供应商类型分标签查看和管理上游配置</p>
          </div>
          <span className="badge rounded-pill" style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 13, padding: '6px 14px' }}>
            共 {providers.length} 个上游
          </span>
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #e8eaed',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(['openai', 'anthropic'] as const).map(type => {
              const tc = TYPE_CONFIG[type]
              const active = activeTypeTab === type
              return (
                <button
                  key={type}
                  onClick={() => setActiveTypeTab(type)}
                  style={{
                    border: `1px solid ${active ? `${tc.color}55` : '#e5e7eb'}`,
                    background: active ? tc.bg : '#fff',
                    color: active ? tc.color : '#4b5563',
                    borderRadius: 999,
                    padding: '8px 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <i className={`bi ${tc.icon}`} style={{ fontSize: 13 }} />
                  {tc.label}
                  <span style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 999,
                    padding: '0 7px',
                    background: active ? '#fff' : '#f3f4f6',
                    color: active ? tc.color : '#6b7280',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {typeCounts[type]}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <ColPicker visible={visibleCols} onChange={updateCols} />
            <button
              className="btn"
              style={{ background: '#1a73e8', color: '#fff', borderRadius: 8, fontSize: 14, padding: '7px 16px', border: 'none' }}
              onClick={openCreate}
            >
              <i className="bi bi-plus-lg me-1" />新增
            </button>
          </div>
        </div>
      </div>

      {/* List - Grouped by Type */}
      {loading ? (
        <div style={{ border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}>
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border me-3" style={{ width: 20, height: 20, borderWidth: 2, color: '#1a73e8' }} />
            <span className="text-muted" style={{ fontSize: 14 }}>加载中...</span>
          </div>
        </div>
      ) : providers.length === 0 ? (
        <div style={{ border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}>
          <div className="text-center p-5">
            <i className="bi bi-cloud-slash" style={{ fontSize: 40, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
            <div className="text-muted" style={{ fontSize: 14 }}>还没有上游配置</div>
            <button
              className="btn btn-sm mt-3"
              style={{ background: '#1a73e8', color: '#fff', borderRadius: 8, border: 'none' }}
              onClick={openCreate}
            >
              <i className="bi bi-plus-lg me-1" />立即添加
            </button>
          </div>
        </div>
      ) : renderTypeSection(activeTypeTab) ?? (
        <div style={{ border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <div className="text-center p-5">
            <i className={`bi ${TYPE_CONFIG[activeTypeTab].icon}`} style={{ fontSize: 36, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
            <div style={{ fontSize: 15, color: '#374151', fontWeight: 600, marginBottom: 6 }}>{TYPE_CONFIG[activeTypeTab].label} 暂无上游</div>
            <div className="text-muted" style={{ fontSize: 14 }}>当前标签下还没有配置，点击右上角新增即可创建。</div>
          </div>
        </div>
      )}

      {/* Provider Form Modal */}
      <div className="modal fade" id="providerModal" tabIndex={-1} ref={modalRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content" style={{ borderRadius: 8, border: 'none', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)', padding: '20px 24px' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`bi ${formMode === 'create' ? 'bi-plus-lg' : 'bi-pencil'} text-white`} style={{ fontSize: 18 }} />
                  </div>
                  <h5 className="text-white mb-0 fw-bold">{formMode === 'create' ? '新增 Upstream' : '编辑 Upstream'}</h5>
                </div>
                <button type="button" data-bs-dismiss="modal" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
                  ×
                </button>
              </div>
            </div>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                  名称 <span className="text-danger">*</span>
                </label>
                <input
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: 14 }}
                  placeholder="如：OpenAI 主账号、Claude 生产"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                  分组 <span className="text-muted fw-normal">（可选，仅用于页面聚合）</span>
                </label>
                <input
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: 14 }}
                  placeholder="如：生产、备用、港区"
                  value={form.group_name ?? ''}
                  onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
                />
                {groupedFormMode && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                    当前分组已存在，优先级和启用状态将继承分组配置。
                  </div>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>类型</label>
                <div className="d-flex gap-2">
                  {(['openai', 'anthropic'] as const).map(t => {
                    const tc = TYPE_CONFIG[t]
                    const active = form.type === t
                    return (
                      <div
                        key={t}
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                          border: `2px solid ${active ? tc.color : '#e8eaed'}`,
                          background: active ? tc.bg : '#fff',
                          display: 'flex', alignItems: 'center', gap: 8,
                          transition: 'all 0.15s',
                        }}
                      >
                        <i className={`bi ${tc.icon}`} style={{ color: tc.color, fontSize: 16 }} />
                        <span style={{ fontWeight: 600, fontSize: 14, color: active ? tc.color : '#3c4043' }}>{tc.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                  API Key {formMode === 'create' && <span className="text-danger">*</span>}
                </label>
                <input
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: 14, fontFamily: 'monospace' }}
                  type="text"
                  placeholder="sk-..."
                  value={form.api_key}
                  onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                  Base URL <span className="text-muted fw-normal">（可选，留空使用官方默认）</span>
                </label>
                <input
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: 14 }}
                  placeholder="https://api.openai.com/v1"
                  value={form.base_url}
                  onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                  代理 <span className="text-muted fw-normal">（可选，SOCKS5 格式）</span>
                </label>
                <input
                  className="form-control"
                  style={{ borderRadius: 8, fontSize: 14, fontFamily: 'monospace' }}
                  placeholder="socks5://user:pass@host:1080"
                  value={form.proxy_url}
                  onChange={e => setForm(f => ({ ...f, proxy_url: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>
                  优先级 <span className="text-muted fw-normal">（1 最高，10 最低）</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range"
                    min={1} max={10} step={1}
                    style={{ flex: 1, accentColor: '#1a73e8', opacity: groupedFormMode ? 0.5 : 1 }}
                    value={existingGroupLeader ? existingGroupLeader.priority : (form.priority ?? 5)}
                    disabled={groupedFormMode}
                    onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                  />
                  <span style={{
                    minWidth: 32, height: 32, borderRadius: 8,
                    background: '#e8f0fe', color: '#1a73e8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 15,
                  }}>
                    {existingGroupLeader ? existingGroupLeader.priority : (form.priority ?? 5)}
                  </span>
                </div>
              </div>
              <div
                onClick={() => setForm(f => ({ ...f, skip_health_check: !f.skip_health_check }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 12,
                  border: `1px solid ${form.skip_health_check ? '#fbbf24' : '#e8eaed'}`,
                  background: form.skip_health_check ? '#fffbeb' : '#f8f9fa',
                  userSelect: 'none', transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 36, height: 20, borderRadius: 10, position: 'relative',
                  background: form.skip_health_check ? '#f59e0b' : '#d1d5db', transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: form.skip_health_check ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: form.skip_health_check ? '#d97706' : '#6b7280' }}>
                    跳过健康检查
                  </span>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    开启后，系统将不检查此上游的健康状态，总是尝试使用
                  </div>
                </div>
              </div>
              <div
                onClick={() => { if (!groupedFormMode) setForm(f => ({ ...f, is_active: !f.is_active })) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10, cursor: groupedFormMode ? 'default' : 'pointer',
                  border: `1px solid ${(existingGroupLeader ? existingGroupLeader.is_active : form.is_active) ? '#86efac' : '#e8eaed'}`,
                  background: (existingGroupLeader ? existingGroupLeader.is_active : form.is_active) ? '#f0fdf4' : '#f8f9fa',
                  userSelect: 'none', transition: 'all 0.15s',
                  opacity: groupedFormMode ? 0.7 : 1,
                }}
              >
                <div style={{
                  width: 36, height: 20, borderRadius: 10, position: 'relative',
                  background: (existingGroupLeader ? existingGroupLeader.is_active : form.is_active) ? '#22c55e' : '#d1d5db', transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: 2, left: (existingGroupLeader ? existingGroupLeader.is_active : form.is_active) ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: (existingGroupLeader ? existingGroupLeader.is_active : form.is_active) ? '#16a34a' : '#6b7280' }}>
                  {(existingGroupLeader ? existingGroupLeader.is_active : form.is_active) ? '创建后立即启用' : '创建后暂不启用'}
                </span>
              </div>
            </div>
            <div className="px-4 pb-4 d-flex gap-2">
              <button
                className="btn flex-grow-1"
                style={{ borderRadius: 8, border: '1px solid #e8eaed', fontSize: 14 }}
                data-bs-dismiss="modal"
              >
                取消
              </button>
              <button
                className="btn flex-grow-1"
                style={{ borderRadius: 8, background: '#1a73e8', color: '#fff', border: 'none', fontSize: 14 }}
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving && <span className="spinner-border spinner-border-sm me-2" />}
                保存
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Models Modal */}
      <div className="modal fade" id="modelsModal" tabIndex={-1}>
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content" style={{ borderRadius: 8, border: 'none', overflow: 'hidden' }}>
            <div style={{ background: '#f8f9fa', borderBottom: '1px solid #e8eaed', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h5 className="mb-0 fw-bold" style={{ fontSize: 15 }}>可用模型</h5>
                <p className="mb-0 text-muted" style={{ fontSize: 13 }}>{modelsModal?.name}</p>
              </div>
              <div className="d-flex align-items-center gap-2">
                {modelsModal && !modelsModal.loading && (
                  <span className="badge rounded-pill" style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 12 }}>
                    {modelsModal.models.length} 个模型
                  </span>
                )}
                <button type="button" data-bs-dismiss="modal" style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>
                  ×
                </button>
              </div>
            </div>
            <div className="modal-body p-4" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {modelsModal?.loading ? (
                <div className="d-flex justify-content-center align-items-center py-4">
                  <div className="spinner-border me-3" style={{ width: 20, height: 20, borderWidth: 2, color: '#1a73e8' }} />
                  <span className="text-muted" style={{ fontSize: 14 }}>获取模型列表...</span>
                </div>
              ) : modelsModal?.models.length === 0 ? (
                <div className="text-center text-muted py-4" style={{ fontSize: 14 }}>暂无可用模型</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {modelsModal?.models.map(m => (
                    <div key={m} style={{
                      background: '#f8f9fa', border: '1px solid #e8eaed',
                      borderRadius: 8, padding: '7px 12px',
                      fontSize: 12, fontFamily: 'monospace', color: '#3c4043',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={m}>
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid #e8eaed' }}>
              <button
                className="btn w-100"
                style={{ borderRadius: 8, border: '1px solid #e8eaed', fontSize: 14 }}
                data-bs-dismiss="modal"
              >
                关闭
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
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 8, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="d-flex align-items-center gap-3 mb-3">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-trash" style={{ color: '#ef4444', fontSize: 18 }} />
              </div>
              <h5 className="mb-0 fw-bold" style={{ fontSize: 16 }}>删除 Upstream</h5>
            </div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              确认删除 <strong style={{ color: '#111' }}>{deleteTarget.name}</strong>？所有使用此上游的请求将失败，此操作不可撤销。
            </p>
            <div className="d-flex gap-2">
              <button
                className="btn flex-grow-1"
                style={{ borderRadius: 8, border: '1px solid #e8eaed', fontSize: 14 }}
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

      {priorityDialog && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1060,
          }}
          onClick={() => setPriorityDialog(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 8, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="d-flex align-items-center gap-3 mb-3">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-sliders" style={{ color: '#1a73e8', fontSize: 18 }} />
              </div>
              <h5 className="mb-0 fw-bold" style={{ fontSize: 16 }}>修改分组优先级</h5>
            </div>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              将该分组内所有 upstream 的优先级统一设置为：
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={priorityDialog.value}
                onChange={e => setPriorityDialog(d => d ? { ...d, value: Number(e.target.value) } : d)}
                style={{ flex: 1, accentColor: '#1a73e8' }}
              />
              <span style={{
                minWidth: 36, height: 36, borderRadius: 10,
                background: '#e8f0fe', color: '#1a73e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 16,
              }}>
                {priorityDialog.value}
              </span>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn flex-grow-1"
                style={{ borderRadius: 8, border: '1px solid #e8eaed', fontSize: 14 }}
                onClick={() => setPriorityDialog(null)}
              >
                取消
              </button>
              <button
                className="btn flex-grow-1"
                style={{ borderRadius: 8, background: '#1a73e8', border: 'none', color: '#fff', fontSize: 14 }}
                onClick={submitGroupPriorityDialog}
                disabled={groupSavingKey === priorityDialog.key}
              >
                {groupSavingKey === priorityDialog.key ? '保存中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
