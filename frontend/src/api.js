const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = localStorage.getItem('antennaguard_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach AntennaGuard API. Make sure the backend is running.')
  }

  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('antennaguard_token')
      localStorage.removeItem('antennaguard_user')
      window.dispatchEvent(new Event('antennaguard:unauthorized'))
    }
    const message = data?.detail || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return data
}

export const api = {
  health: () => request('/health'),
  modelInfo: () => request('/model-info'),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/auth/me'),
  preview: (payload) => request('/predictions/preview', { method: 'POST', body: JSON.stringify(payload) }),
  compare: (payload) => request('/predictions/compare', { method: 'POST', body: JSON.stringify(payload) }),
  predict: (payload) => request('/predictions/predict', { method: 'POST', body: JSON.stringify(payload) }),
  history: (limit = 100) => request(`/predictions/history?limit=${limit}`),
  stats: () => request('/predictions/stats'),
  batch: (file) => {
    const body = new FormData()
    body.append('file', file)
    return request('/predictions/batch', { method: 'POST', body })
  },
  importEda: (file, sourceTool) => {
    const body = new FormData()
    body.append('file', file)
    body.append('source_tool', sourceTool)
    return request('/eda/import', { method: 'POST', body })
  },
  edaRecords: (limit = 100) => request(`/eda/records?limit=${limit}`),
  verifications: (limit = 100) => request(`/eda/verifications?limit=${limit}`),
  edaEvaluation: (technology = '', ruleDeck = '') => {
    const query = new URLSearchParams()
    if (technology) query.set('technology', technology)
    if (ruleDeck) query.set('rule_deck', ruleDeck)
    return request(`/eda/evaluation${query.size ? `?${query.toString()}` : ''}`)
  },
  recordVerification: (payload) => request('/eda/verifications', { method: 'POST', body: JSON.stringify(payload) }),
  verifiedDataset: async () => {
    const headers = new Headers()
    const token = localStorage.getItem('antennaguard_token')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let response
    try { response = await fetch(`${API_BASE}/eda/verified-dataset.csv`, { headers }) }
    catch { throw new Error('Cannot reach AntennaGuard API. Make sure the backend is running.') }
    if (!response.ok) {
      const text = await response.text()
      let detail = text
      try { detail = JSON.parse(text)?.detail || text } catch {}
      throw new Error(detail || `Request failed (${response.status})`)
    }
    return response.blob()
  },
}
