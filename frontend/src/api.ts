import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

const TOKEN_KEY = 'admin_token'

export const authStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// 请求拦截：自动附加 token
http.interceptors.request.use(cfg => {
  const token = authStorage.get()
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// 响应拦截：401 清除 token 并跳转到登录页
http.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      authStorage.clear()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (username: string, password: string) =>
    http.post<{ token: string }>('/auth/login', { username, password }).then(r => r.data),
  logout: () => http.post('/auth/logout'),
  me: () => http.get<{ username: string }>('/auth/me').then(r => r.data),
}

// ---- Stats ----
export interface StatsOverview {
  total_requests: number
  success_requests: number
  error_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
}

export interface UsagePoint {
  date: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  requests: number
  success_requests: number
  avg_latency_ms: number
  avg_first_token_latency_ms: number
}

export interface ModelStat {
  model: string
  total_tokens: number
  requests: number
}

export interface ApiKeyStat {
  api_key_prefix: string
  total_tokens: number
  requests: number
}

export const statsApi = {
  overview: () => http.get<StatsOverview>('/stats/overview').then(r => r.data),
  usage: (granularity: 'day' | 'week' | 'month') =>
    http.get<UsagePoint[]>('/stats/usage', { params: { granularity } }).then(r => r.data),
  byModel: () => http.get<ModelStat[]>('/stats/by-model').then(r => r.data),
  byApiKey: () => http.get<ApiKeyStat[]>('/stats/by-apikey').then(r => r.data),
}

// ---- Logs ----
export interface LogItem {
  id: number
  provider_name: string | null
  key_name: string | null
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  status: 'success' | 'error'
  latency_ms: number
  created_at: string
  request_summary: string | null
  system_prompt: string | null
  response_summary: string | null
  error_message: string | null
  client_ip: string | null
  first_token_latency_ms: number
  is_stream: boolean
  cache_read_tokens: number
  cache_write_tokens: number
}

export interface LogsResponse {
  total: number
  items: LogItem[]
}

export const logsApi = {
  list: (params: { page?: number; page_size?: number; status?: string; model?: string; provider_name?: string; key_name?: string }) =>
    http.get<LogsResponse>('/logs', { params }).then(r => r.data),
}

// ---- Providers ----
export interface ProviderOut {
  id: number
  name: string
  group_name: string | null
  type: 'openai' | 'anthropic'
  api_key_prefix: string
  base_url: string | null
  proxy_url: string | null
  is_active: boolean
  priority: number
  skip_health_check: boolean
  created_at: string
  last_check_at: string | null
  last_check_success: boolean | null
  last_check_error: string | null
  last_check_latency_ms: number | null
}

export interface ProviderCreate {
  name: string
  group_name?: string | null
  type: 'openai' | 'anthropic'
  api_key: string
  base_url?: string
  proxy_url?: string
  is_active?: boolean
  priority?: number
  skip_health_check?: boolean
}

export interface ProviderUpdate {
  name?: string
  group_name?: string | null
  type?: 'openai' | 'anthropic'
  api_key?: string
  base_url?: string
  proxy_url?: string
  is_active?: boolean
  priority?: number
  skip_health_check?: boolean
}

export interface ProviderDetail extends ProviderOut {
  api_key: string
}

export interface ProviderTokenStats {
  provider_id: number
  total_input_tokens: number
  total_output_tokens: number
  today_input_tokens: number
  today_output_tokens: number
}

export const providersApi = {
  list: () => http.get<ProviderOut[]>('/providers').then(r => r.data),
  get: (id: number) => http.get<ProviderDetail>(`/providers/${id}`).then(r => r.data),
  create: (body: ProviderCreate) => http.post<ProviderOut>('/providers', body).then(r => r.data),
  update: (id: number, body: ProviderUpdate) => http.put<ProviderOut>(`/providers/${id}`, body).then(r => r.data),
  delete: (id: number) => http.delete(`/providers/${id}`),
  test: (id: number) => http.post<{ success: boolean; message: string; latency_ms: number }>(`/providers/${id}/test`).then(r => r.data),
  models: (id: number) => http.get<{ models: string[] }>(`/providers/${id}/models`).then(r => r.data),
  tokenStats: () => http.get<ProviderTokenStats[]>('/providers/token-stats').then(r => r.data),
}

// ---- Keys ----
export interface KeyOut {
  id: number
  name: string
  key: string
  is_active: boolean
  token_limit: number | null
  created_at: string
}

export interface KeyTokenStats {
  client_key_id: number
  total_input_tokens: number
  total_output_tokens: number
  today_input_tokens: number
  today_output_tokens: number
}

export const keysApi = {
  list: () => http.get<KeyOut[]>('/keys').then(r => r.data),
  create: (name: string) => http.post<KeyOut>('/keys', { name }).then(r => r.data),
  update: (id: number, body: { name?: string; is_active?: boolean; token_limit?: number | null }) =>
    http.put<KeyOut>(`/keys/${id}`, body).then(r => r.data),
  delete: (id: number) => http.delete(`/keys/${id}`),
  tokenStats: () => http.get<KeyTokenStats[]>('/keys/token-stats').then(r => r.data),
}
