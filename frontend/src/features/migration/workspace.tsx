import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Database,
  Filter,
  Info,
  ListFilter,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/common/status";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { useMigrations } from "./context";
import type { AuditEvent, Escalation, Execution, Mapping, Migration } from "./types";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="metric-cell">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
function Toolbar({
  search,
  onSearch,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <label className="search-field">
        <Search />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search"
        />
      </label>
      {children}
    </div>
  );
}
function Pagination({
  total,
  page,
  setPage,
  pageSize = 10,
}: {
  total: number;
  page: number;
  setPage: (value: number) => void;
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : "0 results"}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setPage(Math.min(pages, page + 1))}
        disabled={page >= pages}
        aria-label="Next page"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
function formatDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}
function percent(done: number, total: number) {
  return total ? Math.min(100, Math.round((done / total) * 100)) : 0;
}
function riskFor(item: Escalation) {
  if (item.type.includes("delete") || item.type.includes("sensitive")) return "Critical";
  if ((item.confidence ?? 1) < 0.5 || item.type.includes("validation")) return "High";
  if ((item.confidence ?? 1) < 0.72 || item.type.includes("conflict")) return "Medium";
  return "Low";
}

export function OverviewPage() {
  const { migrations, loading, error, refresh } = useMigrations();
  const [newOpen, setNewOpen] = useState(false);
  const totals = migrations.reduce(
    (a, m) => ({
      records: a.records + m.records_processed,
      review: a.review + m.review_count,
      success: a.success + m.success_count,
      failed: a.failed + m.failed_count,
    }),
    { records: 0, review: 0, success: 0, failed: 0 },
  );
  const active = migrations.filter(
    (m) => !["completed", "rolled_back", "failed"].includes(m.status),
  ).length;
  if (loading && !migrations.length) return <LoadingState />;
  if (error && !migrations.length) return <ErrorState message={error} onRetry={refresh} />;
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Migration operations and implementation health."
        actions={
          <Button className="btn-cta" onClick={() => setNewOpen(true)}>
            <Plus />
            New Migration
          </Button>
        }
      />
      <section className="metric-strip">
        <Metric label="Active migrations" value={String(active).padStart(2, "0")} />
        <Metric label="Records processed" value={totals.records.toLocaleString()} />
        <Metric label="Awaiting review" value={totals.review.toLocaleString()} />
        <Metric label="Successful" value={totals.success.toLocaleString()} />
        <Metric label="Failed" value={totals.failed.toLocaleString()} />
      </section>
      <section className="section-block">
        <div className="section-title">
          <div>
            <h3>Recent Migrations</h3>
            <p>Latest implementation activity across this workspace.</p>
          </div>
          <Link to="/migrations" className="text-link">
            View all <ArrowRight />
          </Link>
        </div>
        <MigrationTable rows={migrations.slice(0, 6)} />
      </section>
      <section className="section-block action-required">
        <div className="section-title">
          <div>
            <span className="section-kicker">Action Required</span>
            <h3>Consultant Work Queue</h3>
            <p>Migration decisions and failures requiring attention.</p>
          </div>
          <strong className="queue-total">{totals.review + totals.failed}</strong>
        </div>
        {totals.review + totals.failed === 0 ? (
          <EmptyState
            title="No action required."
            description="All migration decisions are currently resolved."
          />
        ) : (
          <div className="action-list">
            {migrations
              .filter((m) => m.review_count || m.failed_count)
              .flatMap((m) => [
                m.review_count ? (
                  <Link key={`${m._id}-review`} to="/escalations" className="action-row">
                    <span className="severity-mark warning" />
                    <span>
                      <strong>
                        {m.review_count} mapping{m.review_count === 1 ? "" : "s"} require review
                      </strong>
                      <small>{m.name}</small>
                    </span>
                    <span>{m.review_count} affected</span>
                    <Button variant="outline" size="sm">
                      Review
                    </Button>
                  </Link>
                ) : null,
                m.failed_count ? (
                  <Link key={`${m._id}-failed`} to="/execution" className="action-row">
                    <span className="severity-mark danger" />
                    <span>
                      <strong>
                        {m.failed_count} execution failure{m.failed_count === 1 ? "" : "s"} require
                        retry
                      </strong>
                      <small>{m.name}</small>
                    </span>
                    <span>{m.failed_count} affected</span>
                    <Button variant="outline" size="sm">
                      Inspect
                    </Button>
                  </Link>
                ) : null,
              ])}
          </div>
        )}
      </section>
      <NewMigrationDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

function MigrationTable({ rows }: { rows: Migration[] }) {
  if (!rows.length)
    return (
      <EmptyState
        title="No migrations yet"
        description="Create a migration to begin importing and reconciling employee data."
      />
    );
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Migration</th>
            <th>Entity</th>
            <th>Source</th>
            <th>Target</th>
            <th className="number">Records</th>
            <th>Progress</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const total = m.success_count + m.failed_count + m.review_count;
            const progress =
              m.status === "completed"
                ? 100
                : percent(m.success_count + m.failed_count, Math.max(total, m.records_processed));
            return (
              <tr key={m._id}>
                <td>
                  <Link
                    to="/migrations/$migrationId"
                    params={{ migrationId: m._id }}
                    className="primary-cell"
                  >
                    {m.name}
                  </Link>
                  <small>{m.tenant_id}</small>
                </td>
                <td>Employee</td>
                <td>
                  {m.files_count
                    ? `${m.files_count} file${m.files_count === 1 ? "" : "s"}`
                    : "Not uploaded"}
                </td>
                <td>HCM target</td>
                <td className="number">{m.records_processed.toLocaleString()}</td>
                <td>
                  <div className="progress-cell">
                    <span>
                      <i style={{ width: `${progress}%` }} />
                    </span>
                    <small>{progress}%</small>
                  </div>
                </td>
                <td>
                  <StatusBadge value={m.status} />
                </td>
                <td>{formatDate(m.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MigrationsPage() {
  const { migrations, loading, error, refresh } = useMigrations();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const rows = migrations
    .filter(
      (m) =>
        (status === "all" || m.status === status) &&
        m.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "records"
          ? b.records_processed - a.records_processed
          : String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
    );
  return (
    <>
      <PageHeader
        title="Migrations"
        subtitle="Manage employee data migrations from intake through verification."
        actions={
          <>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw />
              Refresh
            </Button>
            <Button className="btn-cta" onClick={() => setOpen(true)}>
              <Plus />
              New Migration
            </Button>
          </>
        }
      />
      {error && <ErrorState message={error} onRetry={refresh} />}
      <Toolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      >
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="filter-select">
            <ListFilter />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {[
              "draft",
              "profiling",
              "mapping",
              "review",
              "executing",
              "completed",
              "failed",
              "rolled_back",
            ].map((v) => (
              <SelectItem value={v} key={v}>
                {v.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="records">Records</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>
      {loading && !migrations.length ? (
        <LoadingState />
      ) : (
        <MigrationTable rows={rows.slice((page - 1) * 10, page * 10)} />
      )}
      <Pagination total={rows.length} page={page} setPage={setPage} />
      <NewMigrationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function NewMigrationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, upload, start } = useMigrations();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [tenant, setTenant] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const steps = [
    "Details",
    "Source Files",
    "Target Schema",
    "AI Mapping",
    "Reconciliation",
    "Validation",
    "Review",
    "Execute",
  ];
  const workspaceSteps: Record<number, [string, string]> = {
    2: [
      "Target Schema",
      "Target schema is read from the configured HCM adapter after processing starts.",
    ],
    3: ["AI Mapping", "Field mapping decisions appear in Mapping Studio after source profiling."],
    4: ["Reconciliation", "Duplicate and conflicting records appear in the migration workspace."],
    5: ["Validation", "Target schema validation results appear in the migration workspace."],
    6: ["Review", "Decisions requiring approval are routed to the Escalations queue."],
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await create(name.trim(), tenant.trim() || undefined);
      if (files.length) await upload(created._id, files);
      await start(created._id);
      onOpenChange(false);
      setStep(0);
      setName("");
      setTenant("");
      setFiles([]);
      await navigate({ to: "/migrations/$migrationId", params: { migrationId: created._id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create migration");
    } finally {
      setBusy(false);
    }
  };
  const phase = workspaceSteps[step];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wizard-dialog">
        <DialogHeader>
          <DialogTitle>New Migration</DialogTitle>
          <DialogDescription>
            Configure intake and review the complete implementation lifecycle.
          </DialogDescription>
        </DialogHeader>
        <div className="wizard-steps">
          {steps.map((label, index) => (
            <div className={cn("wizard-step", index <= step && "active")} key={label}>
              <span>{index < step ? <Check /> : index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>
        {step === 0 && (
          <div className="form-stack">
            <label>
              Migration name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. India Workforce Migration"
                autoFocus
              />
            </label>
            <label>
              Workspace / tenant <span>Optional</span>
              <Input
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="Uses the configured workspace when blank"
              />
            </label>
          </div>
        )}
        {step === 1 && (
          <label className="upload-zone">
            <Upload />
            <strong>Select source files</strong>
            <span>CSV and XLSX, subject to configured upload limits</span>
            <Input
              type="file"
              multiple
              accept=".csv,.xlsx"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && <small>{files.map((f) => f.name).join(", ")}</small>}
          </label>
        )}
        {phase && (
          <div className="lifecycle-preview">
            <CircleDot />
            <div>
              <h3>{phase[0]}</h3>
              <p>{phase[1]}</p>
              <span>Available in the migration workspace after processing starts</span>
            </div>
          </div>
        )}
        {step === 7 && (
          <div className="review-summary">
            <dl>
              <div>
                <dt>Migration</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{tenant || "Configured default"}</dd>
              </div>
              <div>
                <dt>Source files</dt>
                <dd>{files.length || "None"}</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>Open workspace and begin processing</dd>
              </div>
            </dl>
            {!files.length && (
              <div className="inline-note">
                <Info />
                The migration will start without files. You can upload files from its Files tab.
              </div>
            )}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => (step ? setStep(step - 1) : onOpenChange(false))}
          >
            {step ? "Back" : "Cancel"}
          </Button>
          {step < 7 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !name.trim()}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button className="btn-cta" onClick={submit} disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Play />}Create and Start
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MappingStudioPage() {
  const { migrations, selectedId, select, bundle, loading } = useMigrations();
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState("all");
  const [sort, setSort] = useState("source");
  const [selected, setSelected] = useState<Mapping | null>(null);
  const [page, setPage] = useState(1);
  const normalizeDecision = (value: string) =>
    value.toLowerCase() === "block" ? "blocked" : value.toLowerCase();
  const rows = (bundle?.mappings || [])
    .filter(
      (m) =>
        (decision === "all" || normalizeDecision(m.autonomy) === decision) &&
        `${m.source_field} ${m.target_field || ""}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "confidence"
        ? b.confidence - a.confidence
        : sort === "target"
          ? String(a.target_field || "").localeCompare(String(b.target_field || ""))
          : a.source_field.localeCompare(b.source_field),
    );
  const counts =
    bundle?.mappings.reduce(
      (a, m) => {
        const key = normalizeDecision(m.autonomy);
        a[key] = (a[key] || 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    ) || {};
  return (
    <>
      <PageHeader
        title="Mapping Studio"
        subtitle="Source-to-target implementation workbench."
        actions={<MigrationPicker migrations={migrations} value={selectedId} onChange={select} />}
      />
      {bundle && (
        <section className="metric-strip four">
          <Metric label="Fields" value={bundle.mappings.length} />
          <Metric label="Auto" value={counts["auto"] || 0} />
          <Metric label="Review" value={counts["review"] || 0} />
          <Metric label="Blocked" value={counts["blocked"] || 0} />
        </section>
      )}
      <Toolbar search={search} onSearch={setSearch}>
        <div className="segmented-filter mapping-filter">
          {["all", "auto", "review", "blocked"].map((value) => (
            <button
              key={value}
              className={decision === value ? "active" : ""}
              onClick={() => {
                setDecision(value);
                setPage(1);
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="source">Source field</SelectItem>
            <SelectItem value="target">Target field</SelectItem>
            <SelectItem value="confidence">Confidence</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>
      {loading && !bundle ? (
        <LoadingState />
      ) : !bundle ? (
        <EmptyState
          title="Select a migration"
          description="Choose a migration to review its mapping decisions."
        />
      ) : !rows.length ? (
        <EmptyState
          title="No mappings found"
          description="Mappings appear after source profiling completes."
        />
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Source Field</th>
                <th>Target Field</th>
                <th>Source Type</th>
                <th>Target Type</th>
                <th>Confidence</th>
                <th>Transformation</th>
                <th>Decision</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 10, page * 10).map((m) => {
                const sourceType = bundle.files.find((f) => f.file_name === m.source_file)?.profile
                  ?.columns?.[m.source_field]?.inferred_type;
                return (
                  <tr key={m._id} onClick={() => setSelected(m)} className="clickable-row">
                    <td className="mono-cell">{m.source_field}</td>
                    <td className="primary-cell">{m.target_field || "Unmapped"}</td>
                    <td>{sourceType || "—"}</td>
                    <td>—</td>
                    <td>
                      <ConfidenceBadge value={m.confidence} />
                    </td>
                    <td>{m.transformation || "Direct mapping"}</td>
                    <td>
                      <StatusBadge value={m.autonomy} />
                    </td>
                    <td>
                      <StatusBadge value={m.status || "proposed"} />
                    </td>
                    <td>
                      <Button variant="ghost" size="icon" aria-label={`Review ${m.source_field}`}>
                        <ChevronRight />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={rows.length} page={page} setPage={setPage} />
      <MappingDrawer
        item={selected}
        files={bundle?.files || []}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
function MappingDrawer({
  item,
  files,
  open,
  onOpenChange,
}: {
  item: Mapping | null;
  files: import("./types").MigrationFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const column = item
    ? files.find((f) => f.file_name === item.source_file)?.profile?.columns?.[item.source_field]
    : undefined;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="detail-drawer">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>Mapping Decision</SheetTitle>
              <SheetDescription>
                {item.source_field} to {item.target_field || "unmapped"}
              </SheetDescription>
            </SheetHeader>
            <DrawerSection title="Source">
              <Detail label="Field" value={item.source_field} />
              <Detail label="Source file" value={item.source_file} />
              <Detail label="Data type" value={column?.inferred_type || "Not reported"} />
              <Detail label="Sample values" value={column?.sample?.join(", ") || "Not reported"} />
            </DrawerSection>
            <DrawerSection title="Target">
              <Detail label="Field" value={item.target_field || "No target selected"} />
              <Detail label="Data type" value="Not reported" />
              <Detail label="Requirement" value="Not reported" />
            </DrawerSection>
            <DrawerSection title="AI Decision">
              <div className="detail-pair">
                <div>
                  <span>Confidence</span>
                  <ConfidenceBadge value={item.confidence} />
                </div>
                <div>
                  <span>Decision</span>
                  <StatusBadge value={item.autonomy} />
                </div>
              </div>
              <Detail label="Recommendation" value={item.reason || "No recommendation reported"} />
              <Detail label="Transformation" value={item.transformation || "Direct mapping"} />
            </DrawerSection>
            <DrawerSection title="Evidence">
              <div className="evidence-list">
                {Object.entries(item.evidence)
                  .filter(([k]) => k !== "weighted_score")
                  .map(([key, value]) => (
                    <div key={key}>
                      <span>{key.replaceAll("_", " ")}</span>
                      <div>
                        <i style={{ width: `${Math.round(value * 100)}%` }} />
                      </div>
                      <strong>{Math.round(value * 100)}%</strong>
                    </div>
                  ))}
              </div>
            </DrawerSection>
            {item.candidates.length > 0 && (
              <DrawerSection title="Candidate targets">
                <div className="tag-list">
                  {item.candidates.map((candidate) => (
                    <span key={candidate}>{candidate}</span>
                  ))}
                </div>
              </DrawerSection>
            )}
            <DrawerSection title="Action">
              <div className="drawer-actions">
                <Button variant="outline" disabled>
                  Reject
                </Button>
                <Button variant="outline" disabled>
                  Correct
                </Button>
                <Button disabled>Approve</Button>
              </div>
              <label className="check-row">
                <Checkbox disabled />
                Apply to Similar
              </label>
            </DrawerSection>
            <div className="drawer-foot-note">
              <Info />
              Direct mapping actions are unavailable through the current service. Reviewable
              decisions are actioned in Escalations.
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function EscalationsPage() {
  const { migrations, selectedId, select, bundle, loading, resolve } = useMigrations();
  const [statusFilter, setStatusFilter] = useState("open");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selected, setSelected] = useState<Escalation | null>(null);
  const rows = (bundle?.escalations || []).filter(
    (item) =>
      (statusFilter === "all" || item.status === statusFilter) &&
      (riskFilter === "all" || riskFor(item).toLowerCase() === riskFilter),
  );
  return (
    <>
      <PageHeader
        title="Escalations"
        subtitle="Enterprise approval queue for decisions requiring consultant review."
        actions={<MigrationPicker migrations={migrations} value={selectedId} onChange={select} />}
      />
      <div className="queue-filters">
        <div className="segmented-filter">
          {["open", "resolved", "all"].map((value) => (
            <button
              key={value}
              className={statusFilter === value ? "active" : ""}
              onClick={() => setStatusFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="filter-select">
            <Filter />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading && !bundle ? (
        <LoadingState />
      ) : !bundle ? (
        <EmptyState
          title="Select a migration"
          description="Choose a migration to review its escalations."
        />
      ) : !rows.length ? (
        <EmptyState
          title="No action required"
          description="All migration decisions in this view are currently resolved."
        />
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Issue</th>
                <th>Migration</th>
                <th>Record</th>
                <th>Field</th>
                <th>Confidence</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item._id} className="clickable-row" onClick={() => setSelected(item)}>
                  <td>
                    <RiskBadge value={riskFor(item)} />
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.type.replaceAll("_", " ")}</small>
                  </td>
                  <td>{bundle.migration.name}</td>
                  <td className="mono-cell">{item.record_id?.split(":").pop() || "—"}</td>
                  <td>{item.target_field || "—"}</td>
                  <td>
                    <ConfidenceBadge value={item.confidence} />
                  </td>
                  <td>
                    <RiskBadge value={riskFor(item)} />
                  </td>
                  <td>
                    <StatusBadge value={item.status} />
                  </td>
                  <td>{formatDate(bundle.migration.updated_at)}</td>
                  <td>
                    <Button variant="ghost" size="icon" aria-label="Review decision">
                      <ChevronRight />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EscalationDrawer
        item={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        onResolve={async (item, payload) => {
          await resolve(item, payload);
          setSelected(null);
        }}
      />
    </>
  );
}
function EscalationDrawer({
  item,
  open,
  onOpenChange,
  onResolve,
}: {
  item: Escalation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (
    item: Escalation,
    payload: {
      action: "approve" | "correct" | "reject" | "skip";
      corrected_value?: string;
      apply_to_similar?: boolean;
      note?: string;
    },
  ) => Promise<void>;
}) {
  const [action, setAction] = useState<"approve" | "correct" | "reject" | "skip" | null>(null);
  const [corrected, setCorrected] = useState("");
  const [note, setNote] = useState("");
  const [similar, setSimilar] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!item || !action) return;
    setBusy(true);
    try {
      await onResolve(item, {
        action,
        apply_to_similar: similar,
        ...(action === "correct" ? { corrected_value: corrected } : {}),
        ...(note ? { note } : {}),
      });
      setAction(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="detail-drawer escalation-drawer">
        {item && (
          <>
            <SheetHeader>
              <div className="drawer-title-row">
                <div>
                  <SheetTitle>Review Required</SheetTitle>
                  <SheetDescription>{item.title}</SheetDescription>
                </div>
                <RiskBadge value={riskFor(item)} />
              </div>
            </SheetHeader>
            <div className="two-column-detail">
              <DrawerSection title="Source Context">
                <Detail label="File" value={item.source_file || "Reconciled record"} />
                <Detail label="Row" value={item.source_row ? String(item.source_row) : "—"} />
                <Detail label="Record" value={item.record_id?.split(":").pop() || "—"} />
                <Detail
                  label="Original value"
                  value={
                    typeof item.source_value === "object"
                      ? JSON.stringify(item.source_value)
                      : String(item.source_value ?? "—")
                  }
                />
              </DrawerSection>
              <DrawerSection title="Proposed Decision">
                <Detail label="Target field" value={item.target_field || "—"} />
                <Detail
                  label="Recommendation"
                  value={item.recommended_action || "Consultant review"}
                />
                <div>
                  <span className="detail-label">Confidence</span>
                  <ConfidenceBadge value={item.confidence} />
                </div>
                {item.candidates.length > 0 && (
                  <div className="tag-list">
                    {item.candidates.map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                )}
              </DrawerSection>
            </div>
            <DrawerSection title="Why the Agent Escalated">
              <p className="reason-box">{item.why}</p>
            </DrawerSection>
            <DrawerSection title="Evidence">
              <dl className="metadata-list">
                {Object.entries(item.evidence).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </DrawerSection>
            {item.impact && (
              <div className="impact-note">
                <AlertTriangle />
                <span>
                  <strong>Impact</strong>
                  {item.impact}
                </span>
              </div>
            )}
            {item.status === "open" ? (
              <div className="sticky-action-area">
                <p>
                  This decision affects {item.impact?.match(/\d+/)?.[0] || "1"} record. Resolving
                  the final open item resumes processing automatically.
                </p>
                {action === "correct" && (
                  <Input
                    value={corrected}
                    onChange={(e) => setCorrected(e.target.value)}
                    placeholder="Enter corrected value"
                  />
                )}
                {action && (
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Decision note (optional)"
                  />
                )}
                <label className="check-row">
                  <Checkbox checked={similar} onCheckedChange={(v) => setSimilar(v === true)} />
                  Apply as a recommendation to similar records
                </label>
                <div className="drawer-actions">
                  <Button variant="outline" onClick={() => setAction("reject")}>
                    Reject
                  </Button>
                  <Button variant="outline" onClick={() => setAction("skip")}>
                    Skip
                  </Button>
                  <Button variant="outline" onClick={() => setAction("correct")}>
                    Correct
                  </Button>
                  <Button
                    onClick={() => (action === "approve" ? void submit() : setAction("approve"))}
                  >
                    Approve
                  </Button>
                </div>
                {action && (
                  <div className="confirm-action">
                    <span>
                      Confirm <strong>{action}</strong> decision?
                    </span>
                    <Button
                      size="sm"
                      onClick={submit}
                      disabled={busy || (action === "correct" && !corrected)}
                    >
                      {busy ? <LoaderCircle className="spin" /> : <Check />}Confirm
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="drawer-foot-note">
                <Check />
                This decision has been resolved.
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ExecutionPage() {
  const { migrations, selectedId, select, bundle, loading, retry, rollback } = useMigrations();
  const [selected, setSelected] = useState<Execution | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const items = bundle?.executions || [];
  const counts = items.reduce(
    (a, item) => {
      a[item.status] = (a[item.status] || 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );
  return (
    <>
      <PageHeader
        title="Execution"
        subtitle="Target operations, retries, verification, and recovery."
        actions={
          <>
            <MigrationPicker migrations={migrations} value={selectedId} onChange={select} />
            {bundle && (
              <Button
                variant="outline"
                onClick={() => setConfirmRollback(true)}
                disabled={!items.some((i) => i.status === "success")}
              >
                <RotateCcw />
                Rollback batch
              </Button>
            )}
          </>
        }
      />
      {bundle && (
        <section className="metric-strip five">
          <Metric label="Total" value={items.length} />
          <Metric label="Successful" value={counts["success"] || 0} />
          <Metric label="Pending" value={counts["pending"] || 0} />
          <Metric label="Failed" value={counts["failed"] || 0} />
          <Metric label="Review" value={bundle.migration.review_count} />
        </section>
      )}
      {loading && !bundle ? (
        <LoadingState />
      ) : !bundle ? (
        <EmptyState
          title="Select a migration"
          description="Choose a migration to inspect execution operations."
        />
      ) : !items.length ? (
        <EmptyState
          title="No execution records"
          description="Operations appear after validation and review are complete."
        />
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Operation</th>
                <th>Target</th>
                <th>Status</th>
                <th className="number">Attempts</th>
                <th className="number">Duration</th>
                <th>Error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="clickable-row" onClick={() => setSelected(item)}>
                  <td className="mono-cell">{item.record_id.split(":").pop()}</td>
                  <td>{item.operation}</td>
                  <td>{item.target_id || "—"}</td>
                  <td>
                    <StatusBadge value={item.status} />
                  </td>
                  <td className="number">{(item.retry_count || 0) + 1}</td>
                  <td className="number">{item.latency_ms} ms</td>
                  <td className="error-cell">{item.error || "—"}</td>
                  <td>
                    <Button variant="ghost" size="icon" aria-label="View execution">
                      <MoreHorizontal />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ExecutionDrawer
        item={selected}
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelected(null)}
        onRetry={bundle ? () => retry(bundle.migration._id) : undefined}
        onRollback={() => setConfirmRollback(true)}
      />
      <Dialog open={confirmRollback} onOpenChange={setConfirmRollback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback successful operations?</DialogTitle>
            <DialogDescription>
              This reverses all successful target mutations for this migration. The operation can
              take several minutes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRollback(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (bundle) await rollback(bundle.migration._id);
                setConfirmRollback(false);
              }}
            >
              Rollback batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function ExecutionDrawer({
  item,
  open,
  onOpenChange,
  onRetry,
  onRollback,
}: {
  item: Execution | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRetry?: (() => Promise<void>) | undefined;
  onRollback: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="detail-drawer">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>
                {item.status === "failed" ? "Execution Failure" : "Execution Detail"}
              </SheetTitle>
              <SheetDescription>{item.record_id.split(":").pop()}</SheetDescription>
            </SheetHeader>
            <DrawerSection title="Operation">
              <Detail label="Record" value={item.record_id} />
              <Detail label="Operation" value={item.operation} />
              <Detail label="Target" value={item.target_id || "Not assigned"} />
              <Detail label="HTTP status" value="Not reported" />
              <Detail label="Attempt count" value={String((item.retry_count || 0) + 1)} />
              <Detail label="Duration" value={`${item.latency_ms} ms`} />
            </DrawerSection>
            {item.error && (
              <DrawerSection title="Error">
                <p className="error-response">{item.error}</p>
              </DrawerSection>
            )}
            <DrawerSection title="Recovery">
              <Detail
                label="Retry state"
                value={item.status === "failed" ? "Eligible for batch retry" : "No retry required"}
              />
              <Detail
                label="Idempotency state"
                value={item.idempotency_key ? "Protected" : "Managed by target adapter"}
              />
            </DrawerSection>
            <div className="sticky-action-area">
              <p>Retry and rollback operate on the migration batch, not this individual record.</p>
              <div className="drawer-actions">
                {item.status === "failed" && onRetry && (
                  <Button onClick={() => void onRetry()}>
                    <RefreshCw />
                    Retry failed batch
                  </Button>
                )}
                <Button variant="outline" onClick={onRollback}>
                  <RotateCcw />
                  Rollback batch
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function AuditLogPage() {
  const { migrations, selectedId, select, bundle, loading } = useMigrations();
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("all");
  const [event, setEvent] = useState("all");
  const [result, setResult] = useState("all");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const events = Array.from(new Set((bundle?.audit || []).map((item) => item.event_type)));
  const results = Array.from(
    new Set((bundle?.audit || []).map((item) => item.status || "recorded")),
  );
  const items = (bundle?.audit || []).filter(
    (item) =>
      (actor === "all" || actorFor(item).toLowerCase() === actor) &&
      (event === "all" || item.event_type === event) &&
      (result === "all" || (item.status || "recorded") === result) &&
      `${item.event_type} ${item.record_id || ""} ${item.message || ""} ${item.timestamp}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Compliance record of migration decisions and operations."
        actions={<MigrationPicker migrations={migrations} value={selectedId} onChange={select} />}
      />
      <Toolbar search={search} onSearch={setSearch}>
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger className="filter-select">
            <Filter />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            <SelectItem value="ai agent">AI Agent</SelectItem>
            <SelectItem value="human">Human</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <Select value={event} onValueChange={setEvent}>
          <SelectTrigger className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((value) => (
              <SelectItem key={value} value={value}>
                {value.replaceAll(".", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            {results.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="date-filter"
          type="date"
          aria-label="Audit date"
          onChange={(e) => setSearch(e.target.value)}
        />
      </Toolbar>
      {loading && !bundle ? (
        <LoadingState />
      ) : !bundle ? (
        <EmptyState
          title="Select a migration"
          description="Choose a migration to inspect its audit trail."
        />
      ) : !items.length ? (
        <EmptyState
          title="No audit events"
          description="Events appear as the migration workflow progresses."
        />
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Record</th>
                <th>Migration</th>
                <th>Result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="clickable-row" onClick={() => setSelected(item)}>
                  <td>{formatDate(item.timestamp)}</td>
                  <td>{actorFor(item)}</td>
                  <td>
                    <strong>{item.event_type.replaceAll(".", " ")}</strong>
                    <small>{item.node || "control plane"}</small>
                  </td>
                  <td className="mono-cell">{item.record_id?.split(":").pop() || "—"}</td>
                  <td>{bundle.migration.name}</td>
                  <td>
                    <StatusBadge value={item.status || "recorded"} />
                  </td>
                  <td>
                    <Button variant="ghost" size="icon">
                      <ChevronRight />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AuditDrawer
        item={selected}
        migrationName={bundle?.migration.name}
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </>
  );
}
function actorFor(item: AuditEvent) {
  if (item.agent === "consultant") return "Human";
  if (["control_plane", "system"].includes(item.agent || "")) return "System";
  return item.agent || item.node ? "AI Agent" : "System";
}
function AuditDrawer({
  item,
  migrationName,
  open,
  onOpenChange,
}: {
  item: AuditEvent | null;
  migrationName: string | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="detail-drawer">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>Audit Event</SheetTitle>
              <SheetDescription>{item.event_type.replaceAll(".", " ")}</SheetDescription>
            </SheetHeader>
            <DrawerSection title="Event">
              <Detail label="Timestamp" value={formatDate(item.timestamp)} />
              <Detail label="Actor" value={actorFor(item)} />
              <Detail
                label="Agent / node"
                value={[item.agent, item.node].filter(Boolean).join(" / ") || "—"}
              />
              <Detail label="Operation" value={item.operation || "—"} />
              <Detail label="Record" value={item.record_id || "—"} />
              <Detail label="Migration" value={migrationName || item.migration_id || "—"} />
              <Detail label="Decision" value={item.message || "Not reported"} />
              <div>
                <span className="detail-label">Result</span>
                <StatusBadge value={item.status || "recorded"} />
              </div>
            </DrawerSection>
            <DrawerSection title="Metadata">
              <pre className="metadata-code">{JSON.stringify(item.metadata || {}, null, 2)}</pre>
            </DrawerSection>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function MigrationDetailPage({ migrationId }: { migrationId: string }) {
  const { select, selectedId, bundle, loading, error, liveEvents, connected, upload, start } =
    useMigrations();
  const [tab, setTab] = useState("overview");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  useEffect(() => {
    if (selectedId !== migrationId) void select(migrationId);
  }, [migrationId, selectedId, select]);
  if (loading && (!bundle || bundle.migration._id !== migrationId)) return <LoadingState />;
  if (error && !bundle) return <ErrorState message={error} onRetry={() => select(migrationId)} />;
  if (!bundle || bundle.migration._id !== migrationId) return null;
  const m = bundle.migration;
  const openEscalations = bundle.escalations.filter((item) => item.status === "open");
  const tabs = [
    "overview",
    "files",
    "mappings",
    "reconciliation",
    "validation",
    "escalations",
    "execution",
    "audit",
  ];
  return (
    <>
      <div className="migration-header">
        <div>
          <Link to="/migrations" className="back-link">
            <ChevronLeft />
            Migrations
          </Link>
          <div className="migration-title-row">
            <h2>{m.name}</h2>
            <span>Employee</span>
            <StatusBadge value={m.status} />
          </div>
          <p>
            Tenant: {m.tenant_id} · Updated {formatDate(m.updated_at)}
          </p>
        </div>
        <div className="page-actions">
          <span className={cn("live-connection", connected && "connected")}>
            <i />
            {connected ? "Live" : "Reconnecting"}
          </span>
          <Button
            variant="outline"
            disabled
            title="Pause is unavailable through the current service"
          >
            <Pause />
            Pause
          </Button>
          <Button
            variant="outline"
            disabled
            title="Cancel is unavailable through the current service"
          >
            <X />
            Cancel
          </Button>
          {m.status === "draft" && (
            <Button onClick={() => start(m._id)}>
              <Play />
              Start Migration
            </Button>
          )}
        </div>
      </div>
      {openEscalations.length > 0 && (
        <div className="escalation-notice" role="status">
          <AlertTriangle />
          <div>
            <strong>
              {openEscalations.length} escalation{openEscalations.length === 1 ? "" : "s"} require
              {openEscalations.length === 1 ? "s" : ""} your review
            </strong>
            <span>Resolve these decisions before the migration can continue to execution.</span>
          </div>
          <Button variant="outline" onClick={() => setTab("escalations")}>
            Review escalations
            <ArrowRight />
          </Button>
        </div>
      )}
      <div className="tab-bar" role="tablist">
        {tabs.map((value) => (
          <button
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => setTab(value)}
          >
            {value}
            {value === "escalations" && openEscalations.length > 0 && (
              <span className="tab-count" aria-label={`${openEscalations.length} open escalations`}>
                {openEscalations.length}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "overview" && <MigrationOverview bundle={bundle} liveEvents={liveEvents} />}
      {tab === "files" && (
        <>
          <PageHeader
            title="Source Files"
            subtitle="Uploaded source data and profiling status."
            actions={
              <label className="button-file">
                <Upload />
                {uploading ? "Uploading…" : "Upload Files"}
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx"
                  disabled={uploading}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploading(true);
                    setUploadError("");
                    try {
                      await upload(m._id, files);
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : "Check the source file and try again.";
                      setUploadError(message);
                      toast.error("Upload failed", { description: message });
                    } finally {
                      setUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            }
          />
          {uploadError && (
            <div className="inline-error">
              <AlertTriangle />
              Upload failed: {uploadError}
            </div>
          )}
          <FilesTable files={bundle.files} />
        </>
      )}
      {tab === "mappings" && <InlineMappings rows={bundle.mappings} />}
      {tab === "reconciliation" && (
        <EvidenceTab
          title="Reconciliation"
          description="Duplicate and conflicting source records identified during normalization."
          items={bundle.escalations.filter(
            (e) => e.type.includes("conflict") || e.type.includes("duplicate"),
          )}
        />
      )}
      {tab === "validation" && (
        <EvidenceTab
          title="Validation"
          description="Records that do not satisfy target schema requirements."
          items={bundle.escalations.filter((e) => e.type.includes("validation"))}
        />
      )}
      {tab === "escalations" && <InlineEscalations items={bundle.escalations} />}
      {tab === "execution" && <InlineExecutions items={bundle.executions} />}
      {tab === "audit" && <InlineAudit items={bundle.audit} />}
    </>
  );
}
function MigrationOverview({
  bundle,
  liveEvents,
}: {
  bundle: NonNullable<ReturnType<typeof useMigrations>["bundle"]>;
  liveEvents: ReturnType<typeof useMigrations>["liveEvents"];
}) {
  const m = bundle.migration;
  const processed = m.success_count + m.failed_count;
  const stages = [
    "INGEST",
    "PROFILE",
    "MAP",
    "RECONCILE",
    "VALIDATE",
    "DECISION",
    "EXECUTE",
    "VERIFY",
    "AUDIT",
  ];
  const nodeIndex: Record<string, number> = {
    profiler: 1,
    mapper: 2,
    reconciler: 3,
    validator: 4,
    decision_gate: 5,
    review: 5,
    executor: 6,
    verifier: 7,
    finalize: 8,
  };
  const activity = liveEvents.length
    ? liveEvents.slice(0, 8)
    : bundle.audit.slice(0, 8).map((a) => ({ ...a, received_at: a.timestamp }));
  const latestActivityNode = activity.find((event) => event.node && nodeIndex[event.node])?.node;
  const currentNode = latestActivityNode || m.current_node || "";
  const active =
    m.status === "completed" ? 8 : (nodeIndex[currentNode] ?? (m.status === "draft" ? 0 : 1));
  return (
    <>
      <section className="metric-strip">
        <Metric label="Records processed" value={m.records_processed.toLocaleString()} />
        <Metric
          label="Remaining"
          value={Math.max(0, m.records_processed - processed).toLocaleString()}
        />
        <Metric label="Successful" value={m.success_count.toLocaleString()} />
        <Metric label="Failed" value={m.failed_count.toLocaleString()} />
        <Metric label="Review required" value={m.review_count.toLocaleString()} />
      </section>
      <div className="detail-grid-layout">
        <section className="section-block">
          <div className="section-title">
            <div>
              <h3>Processing Pipeline</h3>
              <p>Current phase: {currentNode.replaceAll("_", " ") || m.status}</p>
            </div>
          </div>
          <div className="pipeline">
            {stages.map((stage, i) => (
              <div
                className={cn("pipeline-step", i < active && "done", i === active && "current")}
                key={stage}
              >
                <span>{i < active ? <Check /> : i === active ? <CircleDot /> : i + 1}</span>
                <strong>{stage}</strong>
                {i < stages.length - 1 && <i />}
              </div>
            ))}
          </div>
        </section>
        <section className="section-block">
          <div className="section-title">
            <div>
              <h3>Live Activity</h3>
              <p>Latest workflow events.</p>
            </div>
          </div>
          {activity.length ? (
            <div className="activity-list">
              {activity.map((event, i) => (
                <div key={`${event.event_type}-${i}`}>
                  <time>{new Date(event.received_at).toLocaleTimeString()}</time>
                  <span>
                    <strong>{event.agent || event.node || "System"}</strong>
                    <small>{event.message || event.event_type.replaceAll(".", " ")}</small>
                  </span>
                  {event.confidence !== undefined && <ConfidenceBadge value={event.confidence} />}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No activity yet"
              description="Workflow events appear after processing begins."
            />
          )}
        </section>
      </div>
    </>
  );
}
function FilesTable({ files }: { files: import("./types").MigrationFile[] }) {
  if (!files.length)
    return (
      <EmptyState
        title="No source files"
        description="Upload CSV or XLSX files to begin source profiling."
      />
    );
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Type</th>
            <th className="number">Records</th>
            <th className="number">Columns</th>
            <th>Status</th>
            <th>Key candidates</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file._id}>
              <td>
                <strong>{file.file_name}</strong>
              </td>
              <td>{file.file_type.toUpperCase()}</td>
              <td className="number">{file.profile?.row_count?.toLocaleString() || 0}</td>
              <td className="number">{file.profile?.headers?.length || 0}</td>
              <td>
                <StatusBadge value="profiled" />
              </td>
              <td>{file.profile?.entity_key_candidates?.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function InlineMappings({ rows }: { rows: Mapping[] }) {
  return (
    <section className="section-block">
      <div className="section-title">
        <div>
          <h3>Field Mappings</h3>
          <p>{rows.length} source-to-target decisions.</p>
        </div>
      </div>
      {rows.length ? (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Target</th>
                <th>Confidence</th>
                <th>Transformation</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m._id}>
                  <td className="mono-cell">{m.source_field}</td>
                  <td>{m.target_field || "Unmapped"}</td>
                  <td>
                    <ConfidenceBadge value={m.confidence} />
                  </td>
                  <td>{m.transformation || "Direct"}</td>
                  <td>
                    <StatusBadge value={m.autonomy} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No mappings available"
          description="Mapping decisions appear after profiling completes."
        />
      )}
    </section>
  );
}
function EvidenceTab({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Escalation[];
}) {
  return (
    <section className="section-block">
      <div className="section-title">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      {items.length ? (
        <InlineEscalations items={items} />
      ) : (
        <EmptyState
          title={`No ${title.toLowerCase()} issues`}
          description="No records currently require attention in this phase."
        />
      )}
    </section>
  );
}
function InlineEscalations({ items }: { items: Escalation[] }) {
  return items.length ? (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Issue</th>
            <th>Record</th>
            <th>Field</th>
            <th>Confidence</th>
            <th>Risk</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e._id}>
              <td>
                <strong>{e.title}</strong>
                <small>{e.why}</small>
              </td>
              <td>{e.record_id?.split(":").pop() || "—"}</td>
              <td>{e.target_field || "—"}</td>
              <td>
                <ConfidenceBadge value={e.confidence} />
              </td>
              <td>
                <RiskBadge value={riskFor(e)} />
              </td>
              <td>
                <StatusBadge value={e.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="No action required"
      description="All migration decisions are currently resolved."
    />
  );
}
function InlineExecutions({ items }: { items: Execution[] }) {
  return items.length ? (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>Operation</th>
            <th>Status</th>
            <th>Target</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e._id}>
              <td>{e.record_id.split(":").pop()}</td>
              <td>{e.operation}</td>
              <td>
                <StatusBadge value={e.status} />
              </td>
              <td>{e.target_id || "—"}</td>
              <td>{e.latency_ms} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="No execution records"
      description="Operations appear after validation and review are complete."
    />
  );
}
function InlineAudit({ items }: { items: AuditEvent[] }) {
  return items.length ? (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Event</th>
            <th>Actor</th>
            <th>Record</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e._id}>
              <td>{formatDate(e.timestamp)}</td>
              <td>{e.event_type.replaceAll(".", " ")}</td>
              <td>{actorFor(e)}</td>
              <td>{e.record_id?.split(":").pop() || "—"}</td>
              <td>
                <StatusBadge value={e.status || "recorded"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title="No audit events" description="Events appear as the workflow progresses." />
  );
}
function MigrationPicker({
  migrations,
  value,
  onChange,
}: {
  migrations: Migration[];
  value: string | null;
  onChange: (id: string) => Promise<void>;
}) {
  return (
    <Select value={value || ""} onValueChange={(v) => void onChange(v)}>
      <SelectTrigger className="migration-picker">
        <Database />
        <SelectValue placeholder="Select migration" />
      </SelectTrigger>
      <SelectContent>
        {migrations.map((m) => (
          <SelectItem value={m._id} key={m._id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
