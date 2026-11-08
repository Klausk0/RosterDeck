import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { previewRoster, saveRosterDraft } from "../lib/roster/rosterService";

type Roster = {
  id: string;
  month_start: string;
  status: "draft" | "ready" | "published";
};

type Conflict = {
  id: string;
  roster_id: string;
  conflict_type: string;
  severity: "hard" | "soft";
  conflict_date: string;
  employee_id: string | null;
  brand_process_id: string | null;
  message: string;
  resolution_status: "open" | "resolved" | "dismissed";
  created_at: string;
};

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
};

type BrandProcess = {
  id: string;
  brand_id: string;
  process_id: string;
};

type Brand = {
  id: string;
  name: string;
};

type Process = {
  id: string;
  name: string;
};

type StatusFilter = "all" | "open" | "resolved" | "dismissed";
type SeverityFilter = "all" | "hard" | "soft";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Conflicts() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const [roster, setRoster] = useState<Roster | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [brandProcesses, setBrandProcesses] = useState<BrandProcess[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [revalidating, setRevalidating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    setRoster(null);
    setConflicts([]);

    const monthStart = `${selectedMonth}-01`;

    const { data: rosterData, error: rosterError } = await supabase
      .from("rosters")
      .select("id, month_start, status")
      .eq("month_start", monthStart)
      .maybeSingle();

    if (rosterError) {
      setError(rosterError.message);
      setLoading(false);
      return;
    }

    if (!rosterData) {
      setLoading(false);
      return;
    }

    setRoster(rosterData as Roster);

    const [
      conflictResult,
      employeeResult,
      brandProcessResult,
      brandResult,
      processResult,
    ] = await Promise.all([
      supabase
        .from("roster_conflicts")
        .select(
          "id, roster_id, conflict_type, severity, conflict_date, employee_id, brand_process_id, message, resolution_status, created_at",
        )
        .eq("roster_id", rosterData.id)
        .order("conflict_date", { ascending: true }),

      supabase.from("employees").select("id, full_name, employee_code"),

      supabase.from("brand_processes").select("id, brand_id, process_id"),

      supabase.from("brands").select("id, name"),

      supabase.from("processes").select("id, name"),
    ]);

    const errors = [
      conflictResult.error,
      employeeResult.error,
      brandProcessResult.error,
      brandResult.error,
      processResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      setError(errors.map((item) => item?.message).join(" | "));
    }

    setConflicts((conflictResult.data ?? []) as Conflict[]);
    setEmployees(employeeResult.data ?? []);
    setBrandProcesses(brandProcessResult.data ?? []);
    setBrands(brandResult.data ?? []);
    setProcesses(processResult.data ?? []);

    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function updateConflict(
    conflict: Conflict,
    newStatus: "resolved" | "dismissed" | "open",
  ) {
    const action =
      newStatus === "resolved"
        ? "mark this conflict as resolved"
        : newStatus === "dismissed"
          ? "dismiss this conflict"
          : "reopen this conflict";

    if (!window.confirm(`Are you sure you want to ${action}?`)) {
      return;
    }

    setUpdatingId(conflict.id);
    setError("");

    const { error } = await supabase
      .from("roster_conflicts")
      .update({ resolution_status: newStatus })
      .eq("id", conflict.id);

    if (error) {
      setError(error.message);
      setUpdatingId(null);
      return;
    }

    setConflicts((current) =>
      current.map((item) =>
        item.id === conflict.id
          ? { ...item, resolution_status: newStatus }
          : item,
      ),
    );

    setUpdatingId(null);
  }

  function getEmployeeName(id: string | null) {
    if (!id) return "Not specified";

    return (
      employees.find((employee) => employee.id === id)?.full_name ??
      "Unknown employee"
    );
  }

  function getBrandProcessName(id: string | null) {
    if (!id) {
      return {
        brand: "Not specified",
        process: "",
      };
    }

    const config = brandProcesses.find((item) => item.id === id);

    if (!config) {
      return {
        brand: "Unknown brand",
        process: "Unknown process",
      };
    }

    return {
      brand:
        brands.find((brand) => brand.id === config.brand_id)?.name ??
        "Unknown brand",
      process:
        processes.find((process) => process.id === config.process_id)?.name ??
        "Unknown process",
    };
  }

  async function handleRevalidate() {
    if (!roster || roster.status === "published") return;

    if (
      !window.confirm(
        "Revalidate this draft using the latest employee availability and operating rules? The existing draft will be replaced.",
      )
    ) {
      return;
    }

    setRevalidating(true);
    setError("");

    try {
      const result = await previewRoster(selectedMonth);
      await saveRosterDraft(selectedMonth, result);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revalidate this roster.",
      );
    } finally {
      setRevalidating(false);
    }
  }

  const filteredConflicts = conflicts.filter((conflict) => {
    const matchesStatus =
      statusFilter === "all" || conflict.resolution_status === statusFilter;

    const matchesSeverity =
      severityFilter === "all" || conflict.severity === severityFilter;

    return matchesStatus && matchesSeverity;
  });

  const openCount = conflicts.filter(
    (item) => item.resolution_status === "open",
  ).length;

  const hardCount = conflicts.filter(
    (item) => item.severity === "hard" && item.resolution_status === "open",
  ).length;

  const softCount = conflicts.filter(
    (item) => item.severity === "soft" && item.resolution_status === "open",
  ).length;

  const resolvedCount = conflicts.filter(
    (item) => item.resolution_status === "resolved",
  ).length;

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ROSTER VALIDATION</span>
          <h1>Conflicts</h1>
          <p>
            Review scheduling conflicts, staffing shortages and unresolved
            coverage issues.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="management-toolbar">
        <label htmlFor="conflict-month">Roster month</label>

        <input
          id="conflict-month"
          type="month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="filter-select"
        />

        <span className="record-count">{conflicts.length} total conflicts</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading conflicts...</div>
      ) : !roster ? (
        <div className="empty-management">
          <div className="empty-icon">
            <AlertTriangle size={26} />
          </div>

          <h3>No roster found for this month</h3>

          <p>
            Generate and save a roster draft first. Its detected conflicts will
            appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="employee-summary">
            <div>
              <span>Total conflicts</span>
              <strong>{conflicts.length}</strong>
            </div>

            <div>
              <span>Open hard conflicts</span>
              <strong>{hardCount}</strong>
            </div>

            <div>
              <span>Open warnings</span>
              <strong>{softCount}</strong>
            </div>

            <div>
              <span>Resolved</span>
              <strong>{resolvedCount}</strong>
            </div>
          </div>

          <div className="management-toolbar">
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <select
              className="filter-select"
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(event.target.value as SeverityFilter)
              }
            >
              <option value="all">All severities</option>
              <option value="hard">Hard conflicts</option>
              <option value="soft">Soft warnings</option>
            </select>

            <span className="record-count">
              {filteredConflicts.length} shown · {openCount} open
            </span>
          </div>

          {conflicts.length === 0 ? (
            <div className="empty-management">
              <div className="empty-icon">
                <CheckCircle2 size={26} />
              </div>

              <h3>No conflicts detected</h3>

              <p>
                The saved roster currently has no recorded scheduling conflicts.
              </p>
            </div>
          ) : filteredConflicts.length === 0 ? (
            <div className="empty-management">
              <h3>No matching conflicts</h3>
              <p>Try changing the severity or status filters.</p>
            </div>
          ) : (
            <div className="conflict-list">
              {filteredConflicts.map((conflict) => {
                const context = getBrandProcessName(conflict.brand_process_id);

                const employee = getEmployeeName(conflict.employee_id);

                return (
                  <article
                    className="panel"
                    key={conflict.id}
                    style={{ marginBottom: "14px", padding: "18px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginBottom: "10px",
                          }}
                        >
                          <span
                            className={`status-tag ${
                              conflict.severity === "hard"
                                ? "status-inactive"
                                : "status-active"
                            }`}
                          >
                            {conflict.severity === "hard"
                              ? "Hard conflict"
                              : "Soft warning"}
                          </span>

                          <span className="status-tag">
                            {conflict.resolution_status}
                          </span>
                        </div>

                        <h3 style={{ marginBottom: "8px" }}>
                          {conflict.message}
                        </h3>

                        <p
                          style={{
                            fontSize: "13px",
                            color: "var(--text-muted, #777)",
                          }}
                        >
                          {conflict.conflict_type.replace(/_/g, " ")}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        {conflict.resolution_status !== "resolved" && (
                          <button
                            className="secondary-button compact-button"
                            disabled={updatingId === conflict.id}
                            onClick={() =>
                              void updateConflict(conflict, "resolved")
                            }
                          >
                            <CheckCircle2 size={14} />
                            Resolve
                          </button>
                        )}

                        {conflict.resolution_status !== "dismissed" && (
                          <button
                            className="secondary-button compact-button"
                            disabled={updatingId === conflict.id}
                            onClick={() =>
                              void updateConflict(conflict, "dismissed")
                            }
                          >
                            <XCircle size={14} />
                            Dismiss
                          </button>
                        )}

                        {conflict.resolution_status !== "open" && (
                          <button
                            className="secondary-button compact-button"
                            disabled={updatingId === conflict.id}
                            onClick={() =>
                              void updateConflict(conflict, "open")
                            }
                          >
                            <Clock size={14} />
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "22px",
                        flexWrap: "wrap",
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid var(--border-color, #e5e7eb)",
                        fontSize: "13px",
                      }}
                    >
                      <span>
                        <strong>Date:</strong>{" "}
                        {formatDate(conflict.conflict_date)}
                      </span>

                      <span>
                        <strong>Brand:</strong> {context.brand}
                      </span>

                      <span>
                        <strong>Process:</strong> {context.process || "—"}
                      </span>

                      <span>
                        <strong>Employee:</strong> {employee}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
