import { createFileRoute } from "@tanstack/react-router";
import { TargetSystemsPage } from "@/features/migration/configuration";
export const Route = createFileRoute("/target-systems")({
  head: () => ({
    meta: [
      { title: "Target Systems — Migration Copilot" },
      { name: "description", content: "Review target integration readiness." },
      { property: "og:title", content: "Target Systems — Migration Copilot" },
      { property: "og:description", content: "Review target integration readiness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TargetSystemsPage,
});
