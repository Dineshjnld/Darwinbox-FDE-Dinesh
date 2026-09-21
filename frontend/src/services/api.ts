import type { AuditEvent, Escalation, Execution, Mapping, Migration } from '../types'

const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, ...init })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  listMigrations: () => request<Migration[]>('/api/migrations'),
  getMigration: (id: string) => request<Migration>(`/api/migrations/${id}`),
  createMigration: (name = 'Employee migration') => request<Migration>('/api/migrations', { method: 'POST', body: JSON.stringify({ name }) }),
  loadSamples: (id: string) => request<unknown[]>(`/api/migrations/${id}/files/sample`, { method: 'POST' }),
  start: (id: string) => request<{ status: string }>(`/api/migrations/${id}/start`, { method: 'POST' }),
  resume: (id: string) => request<{ status: string }>(`/api/migrations/${id}/resume`, { method: 'POST' }),
  mappings: (id: string) => request<Mapping[]>(`/api/migrations/${id}/mappings`).catch(() => request<Mapping[]>(`/api/migrations/${id}/mapping-decisions`)),
  escalations: (id: string) => request<Escalation[]>(`/api/migrations/${id}/escalations`),
  resolve: (id: string, body: { action: string; corrected_value?: unknown; apply_to_similar?: boolean }) => request<Escalation>(`/api/escalations/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
  executions: (id: string) => request<Execution[]>(`/api/migrations/${id}/executions`),
  retry: (id: string) => request<{ status: string }>(`/api/migrations/${id}/executions/retry`, { method: 'POST' }),
  rollback: (id: string) => request<{ rolled_back: number }>(`/api/migrations/${id}/rollback`, { method: 'POST' }),
  audit: (id: string) => request<AuditEvent[]>(`/api/migrations/${id}/audit`),
}

export { API }
