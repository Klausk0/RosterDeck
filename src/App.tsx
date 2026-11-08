import Employees from "./pages/Employees";
import Pods from "./pages/Pods";
import Login from "./pages/Login.tsx";
import { useAuth } from "./lib/AuthContext";
import Brands from "./pages/Brands";
import Availability from "./pages/Availability";
import Roster from "./pages/Roster";
import Conflicts from "./pages/Conflicts";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import SettingsPage from "./pages/Settings";
import OperatingRules from "./pages/OperatingRules";

import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  CalendarDays,
  AlertTriangle,
  Settings,
  ClipboardList,
  ChevronDown,
  Plus,
  Search,
  Bell,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Circle,
  RefreshCw,
} from "lucide-react";
import "./App.css";

const navigation = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Roster", path: "/roster", icon: CalendarDays },
  { label: "Employees", path: "/employees", icon: Users },
  { label: "Brands", path: "/brands", icon: Building2 },
  { label: "Pods", path: "/pods", icon: Layers },
  { label: "Conflicts", path: "/conflicts", icon: AlertTriangle },
  {
    label: "Availability",
    path: "/availability",
    icon: CalendarDays,
  },
  {
    label: "Operating Rules",
    path: "/operating-rules",
    icon: CalendarDays,
  },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-logo">
        <div className="logo-mark">R</div>
        <div>
          <h2>RosterDesk</h2>
          <span>WORKFORCE MANAGEMENT</span>
        </div>
      </div>

      <div className="workspace">
        <div className="workspace-icon">D</div>
        <div className="workspace-info">
          <strong>DataStraw Operations</strong>
          <span>Workspace</span>
        </div>
        <ChevronDown size={16} />
      </div>

      <div className="nav-section">
        <span className="nav-heading">WORKSPACE</span>

        {navigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
      <div className="sidebar-bottom">
        <NavLink to="/settings" className="nav-link">
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>

        <div className="user-profile">
          <div className="avatar">OM</div>
          <div>
            <strong>Operations Manager</strong>
            <span>Administrator</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  return (
    <header className="topbar">
      <div>
        <span className="breadcrumb">Workspace / </span>
        <strong>Overview</strong>
      </div>

      <div className="topbar-actions">
        <button className="icon-button" aria-label="Search">
          <Search size={18} />
        </button>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <div className="avatar">OM</div>
      </div>
    </header>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="stat-card">
      <span className="stat-title">{title}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-subtitle">{subtitle}</span>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    employees: 0,
    brands: 0,
    pods: 0,
    processes: 0,
    assignments: 0,
    rosterEntries: 0,
    hardConflicts: 0,
    softConflicts: 0,
    rosterStatus: "not_created",
  });

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}`;

  const monthLabel = new Date(`${currentMonth}-01T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    },
  );

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          employeesResult,
          brandsResult,
          podsResult,
          processesResult,
          assignmentsResult,
          rosterResult,
        ] = await Promise.all([
          supabase
            .from("employees")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true),

          supabase
            .from("brands")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true),

          supabase.from("pods").select("*", { count: "exact", head: true }),

          supabase
            .from("brand_processes")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true),

          supabase
            .from("assignments")
            .select("*", { count: "exact", head: true }),

          supabase
            .from("rosters")
            .select("id, status")
            .eq("month_start", `${currentMonth}-01`)
            .maybeSingle(),
        ]);

        const results = [
          employeesResult,
          brandsResult,
          podsResult,
          processesResult,
          assignmentsResult,
          rosterResult,
        ];

        const failedResult = results.find((result) => result.error);

        if (failedResult?.error) {
          throw failedResult.error;
        }

        let rosterEntries = 0;
        let hardConflicts = 0;
        let softConflicts = 0;
        let rosterStatus = "not_created";

        if (rosterResult.data) {
          rosterStatus = rosterResult.data.status;

          const [entriesResult, conflictsResult] = await Promise.all([
            supabase
              .from("roster_entries")
              .select("*", { count: "exact", head: true })
              .eq("roster_id", rosterResult.data.id),

            supabase
              .from("roster_conflicts")
              .select("severity")
              .eq("roster_id", rosterResult.data.id)
              .eq("resolution_status", "open"),
          ]);

          if (entriesResult.error) throw entriesResult.error;
          if (conflictsResult.error) throw conflictsResult.error;

          rosterEntries = entriesResult.count ?? 0;

          hardConflicts =
            conflictsResult.data?.filter(
              (conflict) => conflict.severity === "hard",
            ).length ?? 0;

          softConflicts =
            conflictsResult.data?.filter(
              (conflict) => conflict.severity === "soft",
            ).length ?? 0;
        }

        setStats({
          employees: employeesResult.count ?? 0,
          brands: brandsResult.count ?? 0,
          pods: podsResult.count ?? 0,
          processes: processesResult.count ?? 0,
          assignments: assignmentsResult.count ?? 0,
          rosterEntries,
          hardConflicts,
          softConflicts,
          rosterStatus,
        });

        setLastUpdated(new Date());
      } catch (err) {
        console.error("Dashboard loading error:", err);
        setError(
          err instanceof Error ? err.message : "Unable to load dashboard data.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentMonth],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const setupItems = [
    {
      label: "Create operational pods",
      description: "Organize employees under pod leads",
      complete: stats.pods > 0,
      path: "/pods",
    },
    {
      label: "Add employees",
      description: "Create employee records and configure weekly offs",
      complete: stats.employees > 0,
      path: "/employees",
    },
    {
      label: "Configure brands and processes",
      description: "Define operating days and minimum staffing",
      complete: stats.brands > 0 && stats.processes > 0,
      path: "/brands",
    },
    {
      label: "Assign employees to processes",
      description: "Connect employees to the work they can perform",
      complete: stats.assignments > 0,
      path: "/employees",
    },
    {
      label: "Generate monthly roster",
      description: "Create and validate the monthly schedule",
      complete: stats.rosterStatus !== "not_created",
      path: "/roster",
    },
  ];

  const completedSteps = setupItems.filter((item) => item.complete).length;

  const rosterStatusLabel =
    {
      not_created: "Not generated",
      draft: "Draft",
      ready: "Ready for review",
      published: "Published",
    }[stats.rosterStatus] ?? stats.rosterStatus;

  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERATIONS OVERVIEW</span>
          <h1>{greeting}</h1>
          <p>Here's your workforce overview for {monthLabel}.</p>
        </div>

        <button className="primary-button" onClick={() => navigate("/roster")}>
          <Plus size={17} />
          Manage roster
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button
            className="text-button"
            onClick={() => void loadDashboard(true)}
          >
            Retry
          </button>
        </div>
      )}

      <section className="stats-grid">
        <button className="stat-card" onClick={() => navigate("/employees")}>
          <span className="stat-title">Active employees</span>
          <strong className="stat-value">
            {loading ? "..." : stats.employees}
          </strong>
          <span className="stat-subtitle">Manage your workforce</span>
        </button>

        <button className="stat-card" onClick={() => navigate("/brands")}>
          <span className="stat-title">Active brands</span>
          <strong className="stat-value">
            {loading ? "..." : stats.brands}
          </strong>
          <span className="stat-subtitle">
            {stats.processes} active brand processes
          </span>
        </button>

        <button className="stat-card" onClick={() => navigate("/pods")}>
          <span className="stat-title">Operational pods</span>
          <strong className="stat-value">{loading ? "..." : stats.pods}</strong>
          <span className="stat-subtitle">Teams and pod leads</span>
        </button>

        <button className="stat-card" onClick={() => navigate("/conflicts")}>
          <span className="stat-title">Open conflicts</span>
          <strong className="stat-value">
            {loading ? "..." : stats.hardConflicts + stats.softConflicts}
          </strong>
          <span className="stat-subtitle">
            {stats.hardConflicts} hard · {stats.softConflicts} soft
          </span>
        </button>
      </section>

      <section className="dashboard-grid">
        <div className="panel main-panel">
          <div className="panel-heading">
            <div>
              <h2>Monthly roster</h2>
              <p>{monthLabel} scheduling overview</p>
            </div>

            <button className="text-button" onClick={() => navigate("/roster")}>
              Open roster <ArrowUpRight size={15} />
            </button>
          </div>

          {loading ? (
            <div className="loading-state">Loading roster information...</div>
          ) : stats.rosterStatus === "not_created" ? (
            <div className="empty-state">
              <div className="empty-icon">
                <CalendarDays size={27} />
              </div>

              <h3>No roster generated yet</h3>

              <p>
                Your {monthLabel} roster has not been created. Configure your
                workforce and generate a draft to inspect staffing coverage.
              </p>

              <button
                className="primary-button"
                onClick={() => navigate("/roster")}
              >
                <Plus size={16} />
                Create monthly roster
              </button>
            </div>
          ) : (
            <div className="roster-overview">
              <div className="roster-overview-status">
                <div>
                  <span className="stat-title">Roster status</span>
                  <h3>{rosterStatusLabel}</h3>
                </div>

                <span
                  className={`status-tag ${
                    stats.rosterStatus === "published"
                      ? "status-active"
                      : "status-inactive"
                  }`}
                >
                  {rosterStatusLabel}
                </span>
              </div>

              <div className="roster-overview-stats">
                <div>
                  <strong>{stats.rosterEntries}</strong>
                  <span>Employee-day entries</span>
                </div>

                <div>
                  <strong>{stats.hardConflicts}</strong>
                  <span>Hard conflicts</span>
                </div>

                <div>
                  <strong>{stats.softConflicts}</strong>
                  <span>Soft warnings</span>
                </div>
              </div>

              <button
                className="primary-button"
                onClick={() => navigate("/roster")}
              >
                Inspect monthly roster
                <ArrowUpRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Setup checklist</h2>
              <p>
                {completedSteps} of {setupItems.length} steps completed
              </p>
            </div>

            <ClipboardList size={19} className="muted-icon" />
          </div>

          <div className="checklist">
            {setupItems.map((item, index) => (
              <div className="check-item" key={item.label}>
                <span className={`check-number ${item.complete ? "done" : ""}`}>
                  {item.complete ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <Circle size={17} />
                  )}
                </span>

                <div>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </div>

                <button
                  className="text-button"
                  onClick={() => navigate(item.path)}
                >
                  {item.complete ? "View" : "Open"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel dashboard-bottom-panel">
        <div className="panel-heading">
          <div>
            <h2>Workspace snapshot</h2>
            <p>Current configuration across your organization</p>
          </div>

          <Activity size={19} className="muted-icon" />
        </div>

        <div className="workspace-snapshot">
          <div>
            <strong>{stats.assignments}</strong>
            <span>Employee-process assignments</span>
          </div>

          <div>
            <strong>{stats.processes}</strong>
            <span>Active brand processes</span>
          </div>

          <div>
            <strong>{stats.pods}</strong>
            <span>Operational pods</span>
          </div>
        </div>

        <div className="dashboard-footer">
          <span>
            {lastUpdated
              ? `Last updated at ${lastUpdated.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Dashboard data"}
          </span>

          <button
            className="secondary-button"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "spinning" : ""} />
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </section>
    </>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">WORKSPACE</span>
        <h1>{title}</h1>
        <p>This section will be implemented in the next stages.</p>
      </div>
    </div>
  );
}

function App() {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return <div style={{ padding: 40 }}>Loading RosterDesk...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-area">
        <Header />

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/pods" element={<Pods />} />
            <Route path="/conflicts" element={<Conflicts />} />
            <Route path="/availability" element={<Availability />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/operating-rules" element={<OperatingRules />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <button className="sign-out-button" onClick={() => void signOut()}>
          Sign out
        </button>
      </main>
    </div>
  );
}

export default App;
