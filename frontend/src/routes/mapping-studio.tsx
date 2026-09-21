import { createFileRoute } from "@tanstack/react-router";
import { MappingStudioPage } from "@/features/migration/workspace";
export const Route = createFileRoute("/mapping-studio")({
  head: () => ({
    meta: [
      { title: "Mapping Studio — Migration Copilot" },
      { name: "description", content: "Review and govern source-to-target field mappings." },
      { property: "og:title", content: "Mapping Studio — Migration Copilot" },
      { property: "og:description", content: "Review and govern source-to-target field mappings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MappingStudioPage,
});
