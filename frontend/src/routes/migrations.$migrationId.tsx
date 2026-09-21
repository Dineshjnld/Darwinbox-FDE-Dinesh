import { createFileRoute } from "@tanstack/react-router";
import { MigrationDetailPage } from "@/features/migration/workspace";
export const Route = createFileRoute("/migrations/$migrationId")({
  head: () => ({
    meta: [
      { title: "Migration Workspace — Migration Copilot" },
      { name: "description", content: "Operational workspace for a migration implementation." },
      { property: "og:title", content: "Migration Workspace — Migration Copilot" },
      {
        property: "og:description",
        content: "Operational workspace for a migration implementation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});
function RouteComponent() {
  const { migrationId } = Route.useParams();
  return <MigrationDetailPage migrationId={migrationId} />;
}
