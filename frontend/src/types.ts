export type View = 'overview' | 'agent' | 'migrations' | 'mappings' | 'escalations' | 'execution' | 'audit' | 'settings'

export interface Migration {
  _id: string
  tenant_id: string
  name: string
  status: string
  files_count: number
  records_processed: number
  auto_approved: number
  review_count: number
  failed_count: number
  success_count: number
  current_node?: string
  created_at: string
  updated_at: string
}

export interface Mapping {
  _id: string
  source_file: string
  source_field: string
  target_field: string
  confidence: number
  autonomy: string
  reason: string
  transformation?: string
  candidates: string[]
  evidence: Record<string, number>
}

export interface Escalation {
  _id: string
  type: string
  status: string
  title: string
  why: string
  source_value?: unknown
  target_field?: string
  candidates: string[]
  confidence?: number
  evidence: Record<string, unknown>
  recommended_action?: string
  impact?: string
  source_file?: string
  source_row?: number
  record_id?: string
}

export interface Execution {
  _id: string
  record_id: string
  operation: string
  status: string
  latency_ms: number
  error?: string
  target_id?: string
  retry_count?: number
}

export interface AuditEvent {
  _id: string
  timestamp: string
  event_type: string
  agent?: string
  node?: string
  operation?: string
  record_id?: string
  status?: string
  latency_ms?: number
  message?: string
  metadata?: Record<string, unknown>
}

