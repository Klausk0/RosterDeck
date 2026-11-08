import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

type ViewType = "company" | "pod" | "brand" | "process" | "employee";

type Employee = {
  id: string;

  full_name: string;

  employee_code: string | null;

  pod_id: string | null;

  weekly_off_days: number[];

  max_daily_assignments: number;

  is_active: boolean;
};

type Pod = {
  id: string;

  name: string;
};

type Brand = {
  id: string;

  name: string;
};

type Process = {
  id: string;

  name: string;
};

type BrandProcess = {
  id: string;

  brand_id: string;

  process_id: string;
};

type Entry = {
  id: string;

  employee_id: string;

  roster_date: string;

  status: string;
};

type Allocation = {
  id: string;

  roster_entry_id: string;

  brand_process_id: string;

  shift_start: string;

  shift_end: string;
};

type LeaveRecord = {
  employee_id: string;

  start_date: string;

  end_date: string;

  leave_type: "leave" | "comp_off";

  status: "pending" | "approved" | "rejected";
};

type AvailabilityException = {
  employee_id: string;

  availability_date: string;

  is_available: boolean;
};

type RosterRow = {
  key: string;

  allocationId: string | null;

  rosterEntryId: string;

  brandProcessId: string | null;

  date: string;

  employee: string;

  employeeId: string;

  employeeCode: string;

  pod: string;

  podId: string | null;

  brand: string;

  brandId: string | null;

  process: string;

  processId: string | null;

  shift: string;

  status: string;
};

type Props = {
  month: string;

  refreshKey: number;
};

const WEEKDAYS = [
  "Monday",

  "Tuesday",

  "Wednesday",

  "Thursday",

  "Friday",

  "Saturday",

  "Sunday",
];

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function formatDate(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);

  const formattedMonth = String(date.getMonth() + 1).padStart(2, "0");

  const formattedDay = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${formattedMonth}-${formattedDay}`;
}

export default function RosterView({ month, refreshKey }: Props) {
  const [view, setView] = useState<ViewType>("company");

  const [selectedId, setSelectedId] = useState("");

  const [rows, setRows] = useState<RosterRow[]>([]);

  const [pods, setPods] = useState<Pod[]>([]);

  const [brands, setBrands] = useState<Brand[]>([]);

  const [processes, setProcesses] = useState<Process[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  const [availabilityExceptions, setAvailabilityExceptions] = useState<
    AvailabilityException[]
  >([]);

  const [rosterId, setRosterId] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [rosterStatus, setRosterStatus] = useState("");

  const [editingRow, setEditingRow] = useState<RosterRow | null>(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [savingEdit, setSavingEdit] = useState(false);

  const [editError, setEditError] = useState("");

  const [editSuccess, setEditSuccess] = useState("");

  const [refreshVersion, setRefreshVersion] = useState(0);

  // Load the saved roster and its supporting data.

  useEffect(() => {
    let cancelled = false;

    async function loadRoster() {
      setLoading(true);

      setError("");

      setRows([]);

      setRosterStatus("");

      setRosterId("");

      try {
        const { data: roster, error: rosterError } = await supabase

          .from("rosters")

          .select("id, status")

          .eq("month_start", `${month}-01`)

          .maybeSingle();

        if (rosterError) throw rosterError;

        if (!roster) {
          if (!cancelled) {
            setRosterStatus("No saved roster exists for this month.");

            setLoading(false);
          }

          return;
        }

        const [
          entryResult,

          employeeResult,

          podResult,

          brandResult,

          processResult,

          brandProcessResult,

          leaveResult,

          availabilityResult,
        ] = await Promise.all([
          supabase

            .from("roster_entries")

            .select("id, employee_id, roster_date, status")

            .eq("roster_id", roster.id)

            .order("roster_date"),

          supabase

            .from("employees")

            .select(
              "id, full_name, employee_code, pod_id, weekly_off_days, max_daily_assignments, is_active",
            ),

          supabase.from("pods").select("id, name"),

          supabase.from("brands").select("id, name"),

          supabase.from("processes").select("id, name"),

          supabase.from("brand_processes").select("id, brand_id, process_id"),

          supabase

            .from("leaves")

            .select("employee_id, start_date, end_date, leave_type, status"),

          supabase

            .from("employee_availability")

            .select("employee_id, availability_date, is_available"),
        ]);

        const errors = [
          entryResult.error,

          employeeResult.error,

          podResult.error,

          brandResult.error,

          processResult.error,

          brandProcessResult.error,

          leaveResult.error,

          availabilityResult.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          throw new Error(errors.map((item) => item?.message).join(" | "));
        }

        const entries = (entryResult.data ?? []) as Entry[];

        const employeeData = (employeeResult.data ?? []) as Employee[];

        const podData = (podResult.data ?? []) as Pod[];

        const brandData = (brandResult.data ?? []) as Brand[];

        const processData = (processResult.data ?? []) as Process[];

        const brandProcessData = (brandProcessResult.data ??
          []) as BrandProcess[];

        const leaveData = (leaveResult.data ?? []) as LeaveRecord[];

        const availabilityData = (availabilityResult.data ??
          []) as AvailabilityException[];

        const entryIds = entries.map((entry) => entry.id);

        let allocationData: Allocation[] = [];

        const batchSize = 100;

        for (let i = 0; i < entryIds.length; i += batchSize) {
          const batch = entryIds.slice(i, i + batchSize);

          const { data, error: allocationError } = await supabase

            .from("roster_allocations")

            .select(
              "id, roster_entry_id, brand_process_id, shift_start, shift_end",
            )

            .in("roster_entry_id", batch);

          if (allocationError) throw allocationError;

          allocationData.push(...((data ?? []) as Allocation[]));
        }

        const employeeMap = new Map(
          employeeData.map((employee) => [employee.id, employee]),
        );

        const podMap = new Map(podData.map((pod) => [pod.id, pod]));

        const brandMap = new Map(brandData.map((brand) => [brand.id, brand]));

        const processMap = new Map(
          processData.map((process) => [process.id, process]),
        );

        const configMap = new Map(
          brandProcessData.map((config) => [config.id, config]),
        );

        const allocationsByEntry = new Map<string, Allocation[]>();

        for (const allocation of allocationData) {
          const current =
            allocationsByEntry.get(allocation.roster_entry_id) ?? [];

          current.push(allocation);

          allocationsByEntry.set(allocation.roster_entry_id, current);
        }

        const result: RosterRow[] = [];

        for (const entry of entries) {
          const employee = employeeMap.get(entry.employee_id);

          if (!employee) continue;

          const pod = employee.pod_id ? podMap.get(employee.pod_id) : undefined;

          const allocations = allocationsByEntry.get(entry.id) ?? [];

          const base = {
            date: entry.roster_date,

            employee: employee.full_name,

            employeeId: employee.id,

            employeeCode: employee.employee_code ?? "—",

            pod: pod?.name ?? "Unassigned",

            podId: employee.pod_id,

            status: entry.status,

            rosterEntryId: entry.id,
          };

          if (allocations.length > 0) {
            for (const allocation of allocations) {
              const config = configMap.get(allocation.brand_process_id);

              const brand = config ? brandMap.get(config.brand_id) : undefined;

              const process = config
                ? processMap.get(config.process_id)
                : undefined;

              result.push({
                key: `${entry.id}-${allocation.brand_process_id}`,

                ...base,

                allocationId: allocation.id,

                brandProcessId: allocation.brand_process_id,

                brand: brand?.name ?? "Unknown brand",

                brandId: config?.brand_id ?? null,

                process: process?.name ?? "Unknown process",

                processId: config?.process_id ?? null,

                shift: `${allocation.shift_start.slice(
                  0,

                  5,
                )} - ${allocation.shift_end.slice(0, 5)}`,
              });
            }
          } else {
            result.push({
              key: entry.id,

              ...base,

              allocationId: null,

              brandProcessId: null,

              brand: "—",

              brandId: null,

              process: "—",

              processId: null,

              shift: "—",
            });
          }
        }

        if (cancelled) return;

        setRows(result);

        setEmployees(employeeData);

        setPods(podData);

        setBrands(brandData);

        setProcesses(processData);

        setLeaves(leaveData);

        setAvailabilityExceptions(availabilityData);

        setRosterId(roster.id);

        setRosterStatus(roster.status);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load roster.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (month) {
      void loadRoster();
    }

    return () => {
      cancelled = true;
    };
  }, [month, refreshKey, refreshVersion]);

  // Apply the selected view filter.

  const filteredRows = useMemo(() => {
    if (view === "company") return rows;

    if (!selectedId) return [];

    return rows.filter((row) => {
      if (view === "pod") return row.podId === selectedId;

      if (view === "brand") return row.brandId === selectedId;

      if (view === "process") return row.processId === selectedId;

      if (view === "employee") return row.employeeId === selectedId;

      return true;
    });
  }, [rows, view, selectedId]);

  const filterOptions = useMemo(() => {
    if (view === "pod") {
      return pods.map((item) => ({
        id: item.id,

        name: item.name,
      }));
    }

    if (view === "brand") {
      return brands.map((item) => ({
        id: item.id,

        name: item.name,
      }));
    }

    if (view === "process") {
      return processes.map((item) => ({
        id: item.id,

        name: item.name,
      }));
    }

    if (view === "employee") {
      return employees.map((item) => ({
        id: item.id,

        name: `${item.full_name} (${item.employee_code ?? "No code"})`,
      }));
    }

    return [];
  }, [view, pods, brands, processes, employees]);

  // Build the calendar dates for the selected month.

  const calendarDays = useMemo(() => {
    if (!month) return [];

    const [year, monthNumber] = month.split("-").map(Number);

    if (!year || !monthNumber) return [];

    const daysInMonth = new Date(year, monthNumber, 0).getDate();

    const firstDay = new Date(year, monthNumber - 1, 1).getDay();

    // Convert Sunday-first JS indexing to Monday-first.

    const leadingEmptyDays = (firstDay + 6) % 7;

    const days: (string | null)[] = [];

    for (let i = 0; i < leadingEmptyDays; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(formatDate(year, monthNumber, day));
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }, [month]);

  // Group the filtered schedule records by date.

  const rowsByDate = useMemo(() => {
    const grouped = new Map<string, RosterRow[]>();

    for (const row of filteredRows) {
      const current = grouped.get(row.date) ?? [];

      current.push(row);

      grouped.set(row.date, current);
    }

    return grouped;
  }, [filteredRows]);

  // Offer every active employee except the employee already covering this shift.
  // Reassignment validation below checks availability, leave, overlaps and workload.
  const replacementCandidates = useMemo(
    () =>
      editingRow
        ? employees.filter(
            (employee) =>
              employee.is_active && employee.id !== editingRow.employeeId,
          )
        : [],
    [editingRow, employees],
  );

  function handleViewChange(nextView: ViewType) {
    setView(nextView);

    setSelectedId("");
  }

  function closeEditPanel() {
    setEditingRow(null);

    setSelectedEmployeeId("");

    setEditError("");

    setEditSuccess("");
  }

  // Validate and reassign a saved shift.

  async function handleReassignment() {
    if (!editingRow || !selectedEmployeeId) {
      setEditError("Select an employee first.");

      return;
    }

    if (!editingRow.allocationId || !editingRow.brandProcessId) {
      setEditError("This schedule record cannot be reassigned.");

      return;
    }

    if (rosterStatus === "published") {
      setEditError("Published rosters cannot be edited.");

      return;
    }

    const targetEmployee = employees.find(
      (employee) => employee.id === selectedEmployeeId,
    );

    if (!targetEmployee || !targetEmployee.is_active) {
      setEditError("The selected employee is not active.");

      return;
    }

    if (selectedEmployeeId === editingRow.employeeId) {
      setEditError("Choose a different employee.");

      return;
    }

    const date = editingRow.date;

    const approvedLeave = leaves.some(
      (leave) =>
        leave.employee_id === selectedEmployeeId &&
        leave.status === "approved" &&
        leave.start_date <= date &&
        leave.end_date >= date,
    );

    if (approvedLeave) {
      setEditError(
        "This employee has approved leave or comp-off on this date.",
      );

      return;
    }

    const availabilityException = availabilityExceptions.find(
      (exception) =>
        exception.employee_id === selectedEmployeeId &&
        exception.availability_date === date,
    );

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

    const isWeeklyOff =
      targetEmployee.weekly_off_days?.includes(weekday) ?? false;

    if (availabilityException?.is_available === false) {
      setEditError("This employee is marked unavailable on this date.");

      return;
    }

    if (!rosterId) {
      setEditError("Could not identify the current roster.");

      return;
    }

    setSavingEdit(true);

    setEditError("");

    let newlyCreatedEntryId: string | null = null;

    try {
      const { data: targetEntry, error: targetEntryError } = await supabase

        .from("roster_entries")

        .select("id, status")

        .eq("roster_id", rosterId)

        .eq("employee_id", selectedEmployeeId)

        .eq("roster_date", date)

        .maybeSingle();

      if (targetEntryError) throw targetEntryError;

      if (
        targetEntry &&
        (targetEntry.status === "leave" || targetEntry.status === "comp_off")
      ) {
        throw new Error(
          "The selected employee already has leave on this date.",
        );
      }

      let targetAllocations: {
        id: string;

        shift_start: string;

        shift_end: string;
      }[] = [];

      if (targetEntry) {
        const { data, error: targetAllocationsError } = await supabase

          .from("roster_allocations")

          .select("id, shift_start, shift_end")

          .eq("roster_entry_id", targetEntry.id);

        if (targetAllocationsError) {
          throw targetAllocationsError;
        }

        targetAllocations = data ?? [];
      }

      if (targetAllocations.length >= targetEmployee.max_daily_assignments) {
        throw new Error(
          "This employee has reached their daily assignment limit.",
        );
      }

      const [shiftStart, shiftEnd] = editingRow.shift.split(" - ");

      const newStart = toMinutes(shiftStart);

      const newEnd = toMinutes(shiftEnd);

      if (newEnd <= newStart) {
        throw new Error("The selected shift has an invalid time range.");
      }

      const hasOverlap = targetAllocations.some((allocation) => {
        const existingStart = toMinutes(allocation.shift_start);

        const existingEnd = toMinutes(allocation.shift_end);

        return newStart < existingEnd && existingStart < newEnd;
      });

      if (hasOverlap) {
        throw new Error(
          "This shift overlaps another allocation for this employee.",
        );
      }

      let targetEntryId = targetEntry?.id;

      if (!targetEntryId) {
        const { data: newEntry, error: insertEntryError } = await supabase

          .from("roster_entries")

          .insert({
            roster_id: rosterId,

            employee_id: selectedEmployeeId,

            roster_date: date,

            status: "working",
          })

          .select("id")

          .single();

        if (insertEntryError) throw insertEntryError;

        targetEntryId = newEntry.id;

        newlyCreatedEntryId = newEntry.id;
      }

      const { error: moveError } = await supabase

        .from("roster_allocations")

        .update({
          roster_entry_id: targetEntryId,
        })

        .eq("id", editingRow.allocationId);

      if (moveError) throw moveError;

      const { error: targetStatusError } = await supabase

        .from("roster_entries")

        .update({ status: "working" })

        .eq("id", targetEntryId);

      if (targetStatusError) throw targetStatusError;

      const { data: remainingAllocations, error: remainingError } =
        await supabase

          .from("roster_allocations")

          .select("id")

          .eq("roster_entry_id", editingRow.rosterEntryId);

      if (remainingError) throw remainingError;

      if (!remainingAllocations || remainingAllocations.length === 0) {
        const { error: originalStatusError } = await supabase

          .from("roster_entries")

          .update({ status: "off" })

          .eq("id", editingRow.rosterEntryId);

        if (originalStatusError) throw originalStatusError;
      }

      setEditSuccess(
        isWeeklyOff
          ? "Shift reassigned. Warning: the replacement employee is working on their preferred weekly off."
          : "Shift reassigned successfully.",
      );

      setEditingRow(null);

      setSelectedEmployeeId("");

      setRefreshVersion((current) => current + 1);
    } catch (err) {
      if (newlyCreatedEntryId) {
        await supabase

          .from("roster_entries")

          .delete()

          .eq("id", newlyCreatedEntryId);
      }

      setEditError(
        err instanceof Error ? err.message : "Could not reassign this shift.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Filters and calendar information */}

      <div className="roster-controls">
        <div className="form-field">
          <label htmlFor="roster-view">View by</label>

          <select
            id="roster-view"
            value={view}
            onChange={(event) =>
              handleViewChange(event.target.value as ViewType)
            }
          >
            <option value="company">Company-wide</option>

            <option value="pod">Pod</option>

            <option value="brand">Brand</option>

            <option value="process">Process</option>

            <option value="employee">Employee</option>
          </select>
        </div>

        {view !== "company" && (
          <div className="form-field">
            <label htmlFor="roster-filter">Select {view}</label>

            <select
              id="roster-filter"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">Choose {view}</option>

              {filterOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <span className="record-count">
          {filteredRows.length} schedule records
        </span>

        <span className="status-tag">{rosterStatus || "Loading"}</span>
      </div>

      {error && (
        <div className="alert-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {editSuccess && (
        <div className="alert-success" style={{ marginTop: 12 }}>
          {editSuccess}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading saved monthly roster...</div>
      ) : !rosterId ? (
        <div className="empty-management">
          <h3>No saved roster found</h3>

          <p>Generate and save a roster for {month} to see its calendar.</p>
        </div>
      ) : view !== "company" && !selectedId ? (
        <div className="empty-management">
          <h3>Select a {view}</h3>

          <p>Choose a {view} above to view its monthly schedule.</p>
        </div>
      ) : (
        <>
          {/* Calendar legend */}

          <div
            style={{
              display: "flex",

              flexWrap: "wrap",

              gap: 16,

              margin: "18px 0",

              fontSize: 13,
            }}
          >
            <span>
              <span style={{ color: "#2563eb" }}>●</span> Working
            </span>

            <span>
              <span style={{ color: "#16a34a" }}>●</span> Published
            </span>

            <span>
              <span style={{ color: "#d97706" }}>●</span> Off
            </span>

            <span>
              <span style={{ color: "#dc2626" }}>●</span> Leave
            </span>
          </div>

          {/* Monday-Sunday calendar */}

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "repeat(7, minmax(125px, 1fr))",

              gap: 6,

              overflowX: "auto",

              paddingBottom: 8,
            }}
          >
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                style={{
                  padding: "12px 6px",

                  textAlign: "center",

                  fontWeight: 600,

                  background: "var(--background-secondary, #f3f4f6)",

                  borderRadius: 6,

                  fontSize: 13,

                  minWidth: 125,
                }}
              >
                {day}
              </div>
            ))}

            {calendarDays.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    style={{
                      minHeight: 160,

                      minWidth: 125,
                    }}
                  />
                );
              }

              const dayRows = rowsByDate.get(date) ?? [];

              const workingRows = dayRows.filter(
                (row) => row.allocationId !== null,
              );

              const offRows = dayRows.filter(
                (row) => !row.allocationId && row.status === "off",
              );

              const leaveRows = dayRows.filter(
                (row) =>
                  !row.allocationId &&
                  (row.status === "leave" || row.status === "comp_off"),
              );

              return (
                <div
                  key={date}
                  style={{
                    minWidth: 125,

                    minHeight: 160,

                    border: "1px solid var(--border-color, #ddd)",

                    borderRadius: 7,

                    padding: 8,

                    background: "var(--background-primary, #fff)",

                    display: "flex",

                    flexDirection: "column",

                    gap: 7,
                  }}
                >
                  {/* Date heading */}

                  <div
                    style={{
                      display: "flex",

                      justifyContent: "space-between",

                      alignItems: "center",

                      borderBottom: "1px solid var(--border-color, #eee)",

                      paddingBottom: 6,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>
                      {Number(date.slice(-2))}
                    </strong>

                    <span
                      style={{
                        fontSize: 11,

                        color: "var(--text-secondary, #777)",
                      }}
                    >
                      {workingRows.length} shifts
                    </span>
                  </div>

                  {/* Employee allocations */}

                  <div
                    style={{
                      display: "flex",

                      flexDirection: "column",

                      gap: 5,

                      overflowY: "auto",

                      maxHeight: 220,
                    }}
                  >
                    {workingRows.map((row) => (
                      <div
                        key={row.key}
                        style={{
                          padding: 6,

                          borderRadius: 5,

                          background:
                            rosterStatus === "published"
                              ? "rgba(22, 163, 74, 0.09)"
                              : "rgba(37, 99, 235, 0.08)",

                          borderLeft:
                            rosterStatus === "published"
                              ? "3px solid #16a34a"
                              : "3px solid #2563eb",

                          fontSize: 11,

                          lineHeight: 1.45,
                        }}
                      >
                        <strong
                          style={{
                            display: "block",

                            fontSize: 11,
                          }}
                        >
                          {row.employee}
                        </strong>

                        <span
                          style={{
                            display: "block",

                            color: "var(--text-secondary, #777)",
                          }}
                        >
                          {row.brand}
                        </span>

                        <span
                          style={{
                            display: "block",
                          }}
                        >
                          {row.process}
                        </span>

                        <span
                          style={{
                            display: "block",

                            color: "var(--text-secondary, #777)",
                          }}
                        >
                          {row.shift}
                        </span>

                        {rosterStatus !== "published" && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              marginTop: 5,

                              padding: "3px 7px",

                              fontSize: 10,
                            }}
                            onClick={() => {
                              setEditingRow(row);

                              setSelectedEmployeeId("");

                              setEditError("");

                              setEditSuccess("");
                            }}
                          >
                            Edit shift
                          </button>
                        )}
                      </div>
                    ))}

                    {offRows.map((row) => (
                      <div
                        key={row.key}
                        style={{
                          padding: 5,

                          borderRadius: 5,

                          background: "rgba(217, 119, 6, 0.09)",

                          borderLeft: "3px solid #d97706",

                          fontSize: 11,
                        }}
                      >
                        <strong>{row.employee}</strong>

                        <div style={{ color: "#d97706" }}>Weekly off</div>
                      </div>
                    ))}

                    {leaveRows.map((row) => (
                      <div
                        key={row.key}
                        style={{
                          padding: 5,

                          borderRadius: 5,

                          background: "rgba(220, 38, 38, 0.08)",

                          borderLeft: "3px solid #dc2626",

                          fontSize: 11,
                        }}
                      >
                        <strong>{row.employee}</strong>

                        <div style={{ color: "#dc2626" }}>
                          {row.status === "comp_off" ? "Comp-off" : "Leave"}
                        </div>
                      </div>
                    ))}

                    {dayRows.length === 0 && (
                      <span
                        style={{
                          fontSize: 11,

                          color: "var(--text-secondary, #999)",

                          padding: 4,
                        }}
                      >
                        No schedule records
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Shift reassignment panel */}

      {editingRow && (
        <div className="content-card" style={{ marginTop: 20 }}>
          <div className="section-heading">
            <div>
              <h2>Reassign shift</h2>

              <p>
                {editingRow.date} · {editingRow.brand} · {editingRow.process} ·{" "}
                {editingRow.shift}
              </p>

              <p>Currently assigned to: {editingRow.employee}</p>
            </div>
          </div>

          <div className="form-field" style={{ maxWidth: 420 }}>
            <label htmlFor="reassignment-employee">Assign to employee</label>

            <select
              id="reassignment-employee"
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              disabled={savingEdit}
            >
              <option value="">Select employee</option>

              {replacementCandidates.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} ({employee.employee_code ?? "No code"})
                </option>
              ))}
            </select>

            {replacementCandidates.length === 0 && (
              <p className="form-hint">
                No other active employees are assigned to this brand/process.
                Add an employee to this process in Assignments before
                reassigning this shift.
              </p>
            )}
          </div>

          {editError && <div className="alert-error">{editError}</div>}

          <div
            style={{
              display: "flex",

              gap: 10,

              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleReassignment()}
              disabled={savingEdit || !selectedEmployeeId}
            >
              {savingEdit ? "Saving..." : "Save reassignment"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={closeEditPanel}
              disabled={savingEdit}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
