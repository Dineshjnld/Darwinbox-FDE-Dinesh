import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/features/migration/workspace";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Migration Copilot" },
      { name: "description", content: "Migration operations and implementation health." },
      { property: "og:title", content: "Overview — Migration Copilot" },
      { property: "og:description", content: "Migration operations and implementation health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});
