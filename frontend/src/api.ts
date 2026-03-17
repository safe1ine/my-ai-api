import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

// ---- Stats ----
export interface StatsOverview {
  total_requests: number
  success_requests: number
  error_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
}

export interface UsagePoint {
  date: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  requests: number
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
  api_key_prefix: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  status: 'success' | 'error'
  latency_ms: number
  created_at: string
  request_summary: string | null
  response_summary: string | null
  error_message: string | null
  client_ip: string | null
  first_token_latency_ms: number
}

export interface LogsResponse {
  total: number
  items: LogItem[]
}

export const logsApi = {
  list: (params: { page?: number; page_size?: number; status?: string; model?: string }) =>
    http.get<LogsResponse>('/logs', { params }).then(r => r.data),
}

// ---- Providers ----
export interface ProviderOut {
  id: number
  name: string
  type: 'openai' | 'anthropic'
  api_key_prefix: string
  base_url: string | null
  is_active: boolean
  created_at: string
}

export interface ProviderCreate {
  name: string
  type: 'openai' | 'anthropic'
  api_key: string
  base_url?: string
  is_active?: boolean
}

export interface ProviderUpdate {
  name?: string
  type?: 'openai' | 'anthropic'
  api_key?: string
  base_url?: string
  is_active?: boolean
}

export const providersApi = {
  list: () => http.get<ProviderOut[]>('/providers').then(r => r.data),
  get: (id: number) => http.get<ProviderOut>(`/providers/${id}`).then(r => r.data),
  create: (body: ProviderCreate) => http.post<ProviderOut>('/providers', body).then(r => r.data),
  update: (id: number, body: ProviderUpdate) => http.put<ProviderOut>(`/providers/${id}`, body).then(r => r.data),
  delete: (id: number) => http.delete(`/providers/${id}`),
  test: (id: number) => http.post<{ success: boolean; message: string }>(`/providers/${id}/test`).then(r => r.data),
  models: (id: number) => http.get<{ models: string[] }>(`/providers/${id}/models`).then(r => r.data),
}

// ---- Keys ----
export interface KeyOut {
  id: number
  name: string
  key: string
  is_active: boolean
  created_at: string
}

export const keysApi = {
  list: () => http.get<KeyOut[]>('/keys').then(r => r.data),
  create: (name: string) => http.post<KeyOut>('/keys', { name }).then(r => r.data),
  update: (id: number, body: { name?: string; is_active?: boolean }) =>
    http.put<KeyOut>(`/keys/${id}`, body).then(r => r.data),
  delete: (id: number) => http.delete(`/keys/${id}`),
}
