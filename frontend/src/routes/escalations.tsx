import { createFileRoute } from "@tanstack/react-router";
import { EscalationsPage } from "@/features/migration/workspace";
export const Route = createFileRoute("/escalations")({
  head: () => ({
    meta: [
      { title: "Escalations — Migration Copilot" },
      { name: "description", content: "Review migration decisions requiring human judgment." },
      { property: "og:title", content: "Escalations — Migration Copilot" },
      {
        property: "og:description",
        content: "Review migration decisions requiring human judgment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EscalationsPage,
});
