import {
  Bot,
  CheckCircle2,
  Database,
  Info,
  LockKeyhole,
  Network,
  Server,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "./workspace";
import { StatusBadge } from "@/components/common/status";
import { useMigrations } from "./context";
export function TargetSystemsPage() {
  return (
    <>
      <PageHeader
        title="Target Systems"
        subtitle="Integration readiness and configured migration targets."
      />
      <div className="integration-list">
        <article className="integration-row">
          <div className="integration-icon">
            <Server />
          </div>
          <div>
            <h3>Mock HCM</h3>
            <p>REST API target used by the configured backend adapter.</p>
          </div>
          <span>Connected</span>
          <StatusBadge value="connected" />
        </article>
        <article className="integration-row">
          <div className="integration-icon">
            <Network />
          </div>
          <div>
            <h3>Darwinbox</h3>
            <p>Darwinbox integration can be configured when tenant/API/MCP access is provided.</p>
          </div>
          <span>Integration Ready</span>
          <StatusBadge value="not configured" />
        </article>
      </div>
      <div className="inline-note">
        <Info />
        Connection state is shown conservatively. No credentials or endpoint URLs are displayed.
      </div>
    </>
  );
}
const policies = [
  ["Field mapping", "Low", "Confidence based", "AUTO ≥ 82% · REVIEW 72–81% · BLOCK below 72%"],
  ["Normalize date", "Low", "Automatic", "Deterministic normalization when format is unambiguous"],
  ["Create employee", "Medium", "Confidence based", "Requires stable employee identity"],
  ["Update employee", "Medium", "Confidence based", "Requires stable employee identity"],
  ["Overwrite sensitive data", "High", "Human approval", "Review required before target mutation"],
  ["Delete employee", "Critical", "Human approval", "Blocked without an explicit rollback path"],
];
export function AgentPoliciesPage() {
  return (
    <>
      <PageHeader
        title="Agent Policies"
        subtitle="Governance controls that determine when migration decisions can proceed."
      />
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Operation</th>
              <th>Risk</th>
              <th>Approval Policy</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            {policies.map(([op, risk, approval, rule]) => (
              <tr key={op}>
                <td>
                  <strong>{op}</strong>
                </td>
                <td>
                  <StatusBadge value={risk} />
                </td>
                <td>{approval}</td>
                <td>{rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="policy-flow">
        <div>
          <Bot />
          <span>AI proposes</span>
        </div>
        <i />
        <div>
          <CheckCircle2 />
          <span>Confidence</span>
        </div>
        <i />
        <div>
          <ShieldCheck />
          <span>Risk</span>
        </div>
        <i />
        <div>
          <LockKeyhole />
          <span>Policy</span>
        </div>
        <i />
        <div>
          <Settings2 />
          <span>AUTO / REVIEW / BLOCK</span>
        </div>
      </section>
      <div className="inline-note">
        <Info />
        Policies reflect the current control-plane behavior and are read-only in this version.
      </div>
    </>
  );
}
export function SettingsPage() {
  const { bundle, migrations } = useMigrations();
  const tenant = bundle?.migration.tenant_id || migrations[0]?.tenant_id || "Not available";
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Workspace, migration, security, and integration configuration."
      />
      <div className="settings-layout">
        <SettingsSection icon={Database} title="Workspace">
          <Setting label="Tenant" value={tenant} />
          <Setting label="Environment" value="Active workspace" />
        </SettingsSection>
        <SettingsSection icon={Bot} title="AI">
          <Setting label="Provider" value="Managed by deployment configuration" />
          <Setting label="Model" value="Not exposed" />
          <Setting label="Confidence thresholds" value="Auto 82% · Review 72%" />
        </SettingsSection>
        <SettingsSection icon={Settings2} title="Migration">
          <Setting label="Upload formats" value="CSV, XLSX" />
          <Setting label="Upload limit" value="Managed by deployment configuration" />
          <Setting label="Retry policy" value="Safe batch replay" />
          <Setting label="Duplicate threshold" value="Managed by control plane" />
        </SettingsSection>
        <SettingsSection icon={ShieldCheck} title="Security">
          <Setting label="Session policy" value="Managed by deployment" />
          <Setting label="Audit retention" value="Managed by deployment" />
          <Setting label="Tool permissions" value="Control-plane enforced" />
        </SettingsSection>
        <SettingsSection icon={Network} title="Integrations">
          <Setting label="Target systems" value="Configure outside the application" />
          <Setting label="MCP configuration" value="Not exposed" />
        </SettingsSection>
      </div>
      <div className="inline-note">
        <LockKeyhole />
        Sensitive values are never displayed. Settings shown here are informational until
        persistence endpoints are available.
      </div>
    </>
  );
}
function SettingsSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Database;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <header>
        <Icon />
        <h3>{title}</h3>
      </header>
      <dl>{children}</dl>
    </section>
  );
}
function Setting({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "Not available"}</dd>
    </div>
  );
}
