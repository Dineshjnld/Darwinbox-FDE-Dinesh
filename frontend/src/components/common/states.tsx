import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function LoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="skeleton-table" aria-label="Loading">
      <div className="skeleton-line wide" />
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-line" key={i} />
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  title = "Unable to load migration data",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-state">
      <AlertTriangle />
      <div>
        <h3>{title}</h3>
        <p>{message || "The migration service is temporarily unavailable."}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <LoaderCircle />
          Retry
        </Button>
      )}
    </div>
  );
}
