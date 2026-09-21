import { createFileRoute } from "@tanstack/react-router";
import { ExecutionPage } from "@/features/migration/workspace";
export const Route = createFileRoute("/execution")({
  head: () => ({
    meta: [
      { title: "Execution — Migration Copilot" },
      {
        name: "description",
        content: "Monitor target operations, retries, verification, and recovery.",
      },
      { property: "og:title", content: "Execution — Migration Copilot" },
      {
        property: "og:description",
        content: "Monitor target operations, retries, verification, and recovery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutionPage,
});
