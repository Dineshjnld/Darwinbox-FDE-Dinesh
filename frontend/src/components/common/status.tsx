import { AlertCircle, CheckCircle2, Circle, Clock3, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const good = new Set(["completed", "success", "auto", "resolved", "connected", "verified"]);
const warn = new Set([
  "review",
  "open",
  "pending",
  "profiling",
  "mapping",
  "executing",
  "started",
  "retrying",
]);
const bad = new Set(["failed", "block", "blocked", "critical"]);
export function StatusBadge({
  value,
  className,
}: {
  value?: string | null | undefined;
  className?: string | undefined;
}) {
  const normalized = (value || "unknown").toLowerCase();
  const Icon = good.has(normalized)
    ? CheckCircle2
    : bad.has(normalized)
      ? XCircle
      : warn.has(normalized)
        ? Clock3
        : Circle;
  const tone = good.has(normalized)
    ? "status-success"
    : bad.has(normalized)
      ? "status-danger"
      : warn.has(normalized)
        ? "status-warning"
        : "status-neutral";
  return (
    <span className={cn("status-badge", tone, className)}>
      <Icon />
      {normalized.replaceAll("_", " ")}
    </span>
  );
}
export function RiskBadge({ value }: { value: string }) {
  const tone =
    value === "Critical" || value === "High"
      ? "status-danger"
      : value === "Medium"
        ? "status-warning"
        : "status-info";
  return (
    <span className={cn("status-badge", tone)}>
      <AlertCircle />
      {value} risk
    </span>
  );
}
export function ConfidenceBadge({ value }: { value?: number | undefined }) {
  if (value === undefined || value === null)
    return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  return (
    <span
      className={cn(
        "confidence-badge",
        pct >= 82 ? "confidence-high" : pct >= 72 ? "confidence-mid" : "confidence-low",
      )}
    >
      {pct}%
    </span>
  );
}
