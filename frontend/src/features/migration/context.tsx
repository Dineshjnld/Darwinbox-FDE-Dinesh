import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, API_URL } from "@/services/api";
import type { Escalation, LiveEvent, Migration, MigrationBundle } from "./types";

type Resolution = {
  action: "approve" | "correct" | "reject" | "skip";
  corrected_value?: unknown;
  apply_to_similar?: boolean;
  note?: string;
};
interface MigrationContextValue {
  migrations: Migration[];
  loading: boolean;
  error: string;
  selectedId: string | null;
  bundle: MigrationBundle | null;
  escalations: Escalation[];
  liveEvents: LiveEvent[];
  connected: boolean;
  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
  create: (name: string, tenant?: string) => Promise<Migration>;
  upload: (id: string, files: File[]) => Promise<void>;
  start: (id: string) => Promise<void>;
  resolve: (item: Escalation, payload: Resolution) => Promise<void>;
  retry: (id: string) => Promise<void>;
  rollback: (id: string) => Promise<number>;
}
const MigrationContext = createContext<MigrationContextValue | null>(null);

async function loadBundle(id: string): Promise<MigrationBundle> {
  const [migration, mappings, escalations, executions, audit, files] = await Promise.all([
    api.getMigration(id),
    api.mappings(id),
    api.escalations(id),
    api.executions(id),
    api.audit(id),
    api.files(id),
  ]);
  return { migration, mappings, escalations, executions, audit, files };
}
export function MigrationProvider({ children }: { children: ReactNode }) {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [bundle, setBundle] = useState<MigrationBundle | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const selectedRef = useRef<string | null>(null);
  const select = useCallback(async (id: string) => {
    selectedRef.current = id;
    setSelectedId(id);
    setLoading(true);
    try {
      setBundle(await loadBundle(id));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load migration data");
    } finally {
      setLoading(false);
    }
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, queue] = await Promise.all([api.listMigrations(), api.allEscalations()]);
      setMigrations(rows);
      setEscalations(queue);
      setError("");
      const id = selectedRef.current;
      if (id) setBundle(await loadBundle(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load migration data");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!selectedId) {
      setConnected(false);
      return;
    }
    const source = new EventSource(`${API_URL}/api/migrations/${selectedId}/events`);
    source.onopen = () => setConnected(true);
    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data) as Partial<LiveEvent>;
        if (data.event_type === "escalation.created") {
          toast.warning("Human review required", {
            description: data.message || "A migration decision needs consultant approval.",
          });
        }
        setLiveEvents((items) =>
          [
            {
              ...data,
              event_type: data.event_type || "activity.updated",
              received_at: new Date().toISOString(),
            },
            ...items,
          ].slice(0, 30),
        );
        void select(selectedId);
        if (data.event_type === "escalation.created" || data.event_type === "escalation.resolved") {
          void refresh();
        }
      } catch {
        /* keep stream available */
      }
    };
    source.onerror = () => setConnected(false);
    return () => {
      source.close();
      setConnected(false);
    };
  }, [selectedId, refresh, select]);
  useEffect(() => {
    if (!selectedId || !bundle || ["completed", "rolled_back"].includes(bundle.migration.status))
      return;
    const timer = window.setInterval(() => void select(selectedId), 10000);
    return () => window.clearInterval(timer);
  }, [selectedId, bundle?.migration.status, select]);
  const create = useCallback(
    async (name: string, tenant?: string) => {
      const created = await api.createMigration(name, tenant);
      setMigrations((rows) => [created, ...rows]);
      await select(created._id);
      toast.success("Migration created");
      return created;
    },
    [select],
  );
  const upload = useCallback(
    async (id: string, files: File[]) => {
      await api.uploadFiles(id, files);
      await select(id);
      toast.success(`${files.length} file${files.length === 1 ? "" : "s"} uploaded`);
    },
    [select],
  );
  const start = useCallback(
    async (id: string) => {
      await api.start(id);
      await select(id);
      toast.success("Migration started");
    },
    [select],
  );
  const resolve = useCallback(
    async (item: Escalation, payload: Resolution) => {
      await api.resolve(item._id, payload);
      await refresh();
      toast.success("Decision recorded", {
        description: "The workflow resumes automatically when all open reviews are resolved.",
      });
    },
    [refresh],
  );
  const retry = useCallback(
    async (id: string) => {
      await api.retry(id);
      await select(id);
      toast.success("Execution retry submitted");
    },
    [select],
  );
  const rollback = useCallback(
    async (id: string) => {
      const result = await api.rollback(id);
      await select(id);
      toast.success("Rollback completed", {
        description: `${result.rolled_back} successful operation${result.rolled_back === 1 ? "" : "s"} reversed.`,
      });
      return result.rolled_back;
    },
    [select],
  );
  const value = useMemo(
    () => ({
      migrations,
      loading,
      error,
      selectedId,
      bundle,
      escalations,
      liveEvents,
      connected,
      refresh,
      select,
      create,
      upload,
      start,
      resolve,
      retry,
      rollback,
    }),
    [
      migrations,
      loading,
      error,
      selectedId,
      bundle,
      escalations,
      liveEvents,
      connected,
      refresh,
      select,
      create,
      upload,
      start,
      resolve,
      retry,
      rollback,
    ],
  );
  return <MigrationContext.Provider value={value}>{children}</MigrationContext.Provider>;
}
export function useMigrations() {
  const value = useContext(MigrationContext);
  if (!value) throw new Error("useMigrations must be used within MigrationProvider");
  return value;
}
