import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Database,
  FileClock,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMigrations } from "@/features/migration/context";
import { cn } from "@/lib/utils";
const navigation = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Migrations", to: "/migrations", icon: Database },
  { label: "Mapping Studio", to: "/mapping-studio", icon: Network },
  { label: "Escalations", to: "/escalations", icon: ClipboardList },
  { label: "Execution", to: "/execution", icon: Activity },
  { label: "Audit Log", to: "/audit-log", icon: FileClock },
] as const;
const configuration = [
  { label: "Target Systems", to: "/target-systems", icon: Bot },
  { label: "Agent Policies", to: "/agent-policies", icon: ShieldCheck },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { bundle, migrations } = useMigrations();
  useEffect(() => setMobileOpen(false), [path]);
  useEffect(() => {
    const saved = window.localStorage.getItem("migration-copilot-theme");
    const next =
      saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem("migration-copilot-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };
  const tenant = bundle?.migration.tenant_id || migrations[0]?.tenant_id || "No workspace data";
  const title = path.startsWith("/migrations/")
    ? bundle?.migration.name || "Migration workspace"
    : [...navigation, ...configuration].find((item) => item.to === path)?.label || "Overview";
  return (
    <div className="app-frame">
      {mobileOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "app-sidebar",
          collapsed && "sidebar-collapsed",
          mobileOpen && "sidebar-mobile-open",
        )}
      >
        <div className="brand-row">
          <div className="brand-logo">
            <img src="/brand/darwinbox-logo.png" alt="Darwinbox" />
          </div>
          <div className="brand-copy">
            <strong>Migration Copilot</strong>
            <span>Implementation Operations</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <button className="workspace-control">
          <span className="workspace-avatar">{tenant.charAt(0).toUpperCase()}</span>
          <span className="workspace-copy">
            <small>Workspace</small>
            <strong>{tenant}</strong>
          </span>
          <ChevronDown />
        </button>
        <SidebarGroup label="Workspace" items={navigation} path={path} />
        <SidebarGroup label="Configuration" items={configuration} path={path} />
        <div className="sidebar-spacer" />
        <button
          className="collapse-control"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
          <span>Collapse sidebar</span>
        </button>
      </aside>
      <div className="app-main">
        <header className="global-header">
          <div className="header-leading">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <div className="breadcrumb-block">
              <div className="breadcrumbs">
                <span>Implementation</span>
                <ChevronRight />
                {path !== "/" && (
                  <>
                    <span>{path.startsWith("/migrations/") ? "Migrations" : title}</span>
                    {path.startsWith("/migrations/") && (
                      <>
                        <ChevronRight />
                        <strong>{title}</strong>
                      </>
                    )}
                  </>
                )}
              </div>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="header-actions">
            <span className="environment">
              <i />
              Workspace active
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            >
              {theme === "light" ? <Moon /> : <Sun />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Help">
              <CircleHelp />
            </Button>
            <button className="profile-control">
              <span>MC</span>
              <span className="profile-copy">
                <strong>Implementation</strong>
                <small>Consultant</small>
              </span>
              <ChevronDown />
            </button>
          </div>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
function SidebarGroup({
  label,
  items,
  path,
}: {
  label: string;
  items: ReadonlyArray<{ label: string; to: string; icon: typeof BookOpen }>;
  path: string;
}) {
  return (
    <nav className="sidebar-group" aria-label={label}>
      <div className="sidebar-label">{label}</div>
      {items.map(({ label: itemLabel, to, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link key={to} to={to} className={cn("sidebar-link", active && "active")}>
            <Icon />
            <span>{itemLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
