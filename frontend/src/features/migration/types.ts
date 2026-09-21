export interface Migration {
  _id: string;
  tenant_id: string;
  name: string;
  status: string;
  files_count: number;
  records_processed: number;
  auto_approved: number;
  review_count: number;
  failed_count: number;
  success_count: number;
  current_node?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}
export interface Mapping {
  _id: string;
  source_file: string;
  source_field: string;
  target_field: string | null;
  confidence: number;
  autonomy: string;
  reason: string;
  transformation?: string | null;
  candidates: string[];
  evidence: Record<string, number>;
  status?: string;
  created_at?: string;
}
export interface Escalation {
  _id: string;
  migration_id?: string;
  type: string;
  status: string;
  title: string;
  why: string;
  source_value?: unknown;
  target_field?: string;
  candidates: string[];
  confidence?: number;
  evidence: Record<string, unknown>;
  recommended_action?: string;
  impact?: string;
  source_file?: string;
  source_row?: number;
  record_id?: string;
  resolution?: Record<string, unknown>;
}
export interface Execution {
  _id: string;
  migration_id?: string;
  record_id: string;
  operation: string;
  status: string;
  latency_ms: number;
  error?: string;
  target_id?: string;
  retry_count?: number;
  idempotency_key?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}
export interface AuditEvent {
  _id: string;
  migration_id?: string;
  timestamp: string;
  event_type: string;
  agent?: string;
  node?: string;
  operation?: string;
  record_id?: string;
  status?: string;
  latency_ms?: number;
  confidence?: number;
  risk?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}
export interface FileProfile {
  file_name: string;
  file_type: string;
  row_count: number;
  headers: string[];
  columns: Record<string, { inferred_type?: string; non_empty?: number; sample?: string[] }>;
  entity_key_candidates?: string[];
}
export interface MigrationFile {
  _id: string;
  migration_id: string;
  file_name: string;
  file_type: string;
  profile: FileProfile;
  sample?: boolean;
}
export interface LiveEvent extends Partial<AuditEvent> {
  event_type: string;
  received_at: string;
}
export interface MigrationBundle {
  migration: Migration;
  mappings: Mapping[];
  escalations: Escalation[];
  executions: Execution[];
  audit: AuditEvent[];
  files: MigrationFile[];
}
