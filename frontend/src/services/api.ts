import type {
  AuditEvent,
  Escalation,
  Execution,
  Mapping,
  Migration,
  MigrationFile,
} from "@/features/migration/types";

export const API_URL =
  import.meta.env["VITE_API_URL"] ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      message = (JSON.parse(raw) as { detail?: string }).detail ?? raw;
    } catch {
      /* text response */
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listMigrations: () => request<Migration[]>("/api/migrations"),
  getMigration: (id: string) => request<Migration>(`/api/migrations/${id}`),
  createMigration: (name: string, tenantId?: string) =>
    request<Migration>("/api/migrations", {
      method: "POST",
      body: JSON.stringify({ name, tenant_id: tenantId || undefined }),
    }),
  files: (id: string) => request<MigrationFile[]>(`/api/migrations/${id}/files`),
  uploadFiles: (id: string, files: File[]) => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    return request<MigrationFile[]>(`/api/migrations/${id}/files`, { method: "POST", body });
  },
  start: (id: string) =>
    request<{ status: string }>(`/api/migrations/${id}/start`, { method: "POST" }),
  resume: (id: string) =>
    request<{ status: string }>(`/api/migrations/${id}/resume`, { method: "POST" }),
  mappings: (id: string) => request<Mapping[]>(`/api/migrations/${id}/mappings`),
  escalations: (id: string) => request<Escalation[]>(`/api/migrations/${id}/escalations`),
  allEscalations: () => request<Escalation[]>("/api/escalations"),
  resolve: (
    id: string,
    body: {
      action: "approve" | "correct" | "reject" | "skip";
      corrected_value?: unknown;
      apply_to_similar?: boolean;
      note?: string;
    },
  ) =>
    request<Escalation>(`/api/escalations/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  executions: (id: string) => request<Execution[]>(`/api/migrations/${id}/executions`),
  retry: (id: string) =>
    request<{ status: string }>(`/api/migrations/${id}/executions/retry`, { method: "POST" }),
  rollback: (id: string) =>
    request<{ rolled_back: number }>(`/api/migrations/${id}/rollback`, { method: "POST" }),
  audit: (id: string) => request<AuditEvent[]>(`/api/migrations/${id}/audit`),
};
