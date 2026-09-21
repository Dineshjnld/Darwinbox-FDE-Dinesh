import { createFileRoute } from "@tanstack/react-router";
import { AgentPoliciesPage } from "@/features/migration/configuration";
export const Route = createFileRoute("/agent-policies")({
  head: () => ({
    meta: [
      { title: "Agent Policies — Migration Copilot" },
      { name: "description", content: "Review migration confidence, risk, and approval policies." },
      { property: "og:title", content: "Agent Policies — Migration Copilot" },
      {
        property: "og:description",
        content: "Review migration confidence, risk, and approval policies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentPoliciesPage,
});
