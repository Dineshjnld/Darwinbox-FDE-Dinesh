import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { MigrationsPage } from "@/features/migration/workspace";
export const Route = createFileRoute("/migrations")({
  head: () => ({
    meta: [
      { title: "Migrations — Migration Copilot" },
      {
        name: "description",
        content: "Manage employee data migrations from intake through verification.",
      },
      { property: "og:title", content: "Migrations — Migration Copilot" },
      {
        property: "og:description",
        content: "Manage employee data migrations from intake through verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MigrationsRouteComponent,
});

function MigrationsRouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isListRoute = pathname === "/migrations" || pathname === "/migrations/";
  return isListRoute ? <MigrationsPage /> : <Outlet />;
}
