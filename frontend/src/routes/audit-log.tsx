import { createFileRoute } from "@tanstack/react-router";
import { AuditLogPage } from "@/features/migration/workspace";
export const Route = createFileRoute("/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log — Migration Copilot" },
      { name: "description", content: "Review the complete migration compliance trail." },
      { property: "og:title", content: "Audit Log — Migration Copilot" },
      { property: "og:description", content: "Review the complete migration compliance trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditLogPage,
});
