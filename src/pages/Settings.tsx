import { useNavigate } from "react-router-dom";
import {
  User,
  Database,
  Users,
  Building2,
  CalendarDays,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";

export default function Settings() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const email = session?.user?.email ?? "No email available";

  const sections = [
    {
      title: "Employee management",
      description: "Manage employee records, weekly offs and assignments.",
      icon: Users,
      path: "/employees",
    },
    {
      title: "Brands and processes",
      description: "Configure operating days, shifts and minimum staffing.",
      icon: Building2,
      path: "/brands",
    },
    {
      title: "Availability and holidays",
      description: "Manage leaves, comp-offs and public holidays.",
      icon: CalendarDays,
      path: "/availability",
    },
    {
      title: "Roster management",
      description: "Generate and inspect monthly workforce schedules.",
      icon: CalendarDays,
      path: "/roster",
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Settings</h1>
          <p>Account information and workspace management.</p>
        </div>
      </div>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div>
            <h2>Account</h2>
            <p>Your currently authenticated account.</p>
          </div>
          <User size={20} />
        </div>

        <div className="settings-account-card">
          <div className="settings-account-avatar">
            {email.charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{email}</strong>
            <span>Authenticated user</span>
          </div>

          <span className="status-tag status-active">
            <ShieldCheck size={13} />
            Signed in
          </span>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div>
            <h2>Workspace information</h2>
            <p>Application and backend configuration.</p>
          </div>
          <Database size={20} />
        </div>

        <div className="settings-info-grid">
          <div className="settings-info-card">
            <span>Application</span>
            <strong>RosterDesk</strong>
          </div>

          <div className="settings-info-card">
            <span>Workspace</span>
            <strong>DataStraw Operations</strong>
          </div>

          <div className="settings-info-card">
            <span>Backend</span>
            <strong>Supabase</strong>
          </div>

          <div className="settings-info-card">
            <span>Authentication</span>
            <strong>Email authentication</strong>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div>
            <h2>Operational configuration</h2>
            <p>Manage these settings in their respective workspace sections.</p>
          </div>
        </div>

        <div className="settings-links">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <button
                className="settings-link"
                key={section.title}
                onClick={() => navigate(section.path)}
              >
                <span className="settings-link-icon">
                  <Icon size={19} />
                </span>

                <span className="settings-link-content">
                  <strong>{section.title}</strong>
                  <small>{section.description}</small>
                </span>

                <ArrowUpRight size={17} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
