import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/migration/configuration";
export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Migration Copilot" },
      { name: "description", content: "Review workspace and migration configuration." },
      { property: "og:title", content: "Settings — Migration Copilot" },
      { property: "og:description", content: "Review workspace and migration configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});
