import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Plus, Pencil, Search, Users, X, Trash2 } from "lucide-react";

import { supabase } from "../lib/supabase";

type Pod = {
  id: string;

  name: string;
};

type Employee = {
  id: string;

  employee_code: string | null;

  full_name: string;

  email: string | null;

  pod_id: string | null;

  weekly_off_days: number[];

  is_active: boolean;

  created_at: string;
};

type RelatedName = { name: string } | { name: string }[] | null;

type BrandProcessOption = {
  id: string;

  brand_id: string;

  process_id: string;

  brands: { name: string } | null;

  processes: { name: string } | null;
};

type EmployeeAssignment = {
  id: string;

  brand_process_id: string;
};

const weekdays = [
  { value: 0, label: "Sunday" },

  { value: 1, label: "Monday" },

  { value: 2, label: "Tuesday" },

  { value: 3, label: "Wednesday" },

  { value: 4, label: "Thursday" },

  { value: 5, label: "Friday" },

  { value: 6, label: "Saturday" },
];

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [pods, setPods] = useState<Pod[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");

  const [employeeCode, setEmployeeCode] = useState("");

  const [email, setEmail] = useState("");

  const [podId, setPodId] = useState("");

  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([0]);

  const [assignmentEmployee, setAssignmentEmployee] = useState<Employee | null>(
    null,
  );

  const [availableProcesses, setAvailableProcesses] = useState<
    BrandProcessOption[]
  >([]);

  const [employeeAssignments, setEmployeeAssignments] = useState<
    EmployeeAssignment[]
  >([]);

  const [selectedProcessId, setSelectedProcessId] = useState("");

  const [assignmentLoading, setAssignmentLoading] = useState(false);

  async function openAssignments(employee: Employee) {
    setAssignmentEmployee(employee);

    setAssignmentLoading(true);

    setError("");

    const [optionsResult, assignmentsResult] = await Promise.all([
      supabase

        .from("brand_processes")

        .select("id, brand_id, process_id, brands(name), processes(name)")

        .eq("is_active", true),

      supabase

        .from("assignments")

        .select("id, brand_process_id")

        .eq("employee_id", employee.id),
    ]);

    if (optionsResult.error || assignmentsResult.error) {
      setError(
        optionsResult.error?.message ??
          assignmentsResult.error?.message ??
          "Could not load assignments.",
      );
    } else {
      setAvailableProcesses(
        (optionsResult.data ?? []).map((option) => ({
          ...option,

          brands: getRelatedName(option.brands as RelatedName),

          processes: getRelatedName(option.processes as RelatedName),
        })),
      );

      setEmployeeAssignments(assignmentsResult.data ?? []);
    }

    setSelectedProcessId("");

    setAssignmentLoading(false);
  }

  async function addEmployeeAssignment() {
    if (!assignmentEmployee || !selectedProcessId) return;

    const alreadyAssigned = employeeAssignments.some(
      (assignment) => assignment.brand_process_id === selectedProcessId,
    );

    if (alreadyAssigned) {
      setError("This employee is already assigned to this process.");

      return;
    }

    const { error } = await supabase.from("assignments").insert({
      employee_id: assignmentEmployee.id,

      brand_process_id: selectedProcessId,
    });

    if (error) {
      setError(error.message);

      return;
    }

    await openAssignments(assignmentEmployee);
  }

  async function removeEmployeeAssignment(assignment: EmployeeAssignment) {
    if (!window.confirm("Remove this employee's process assignment?")) return;

    const { error } = await supabase

      .from("assignments")

      .delete()

      .eq("id", assignment.id);

    if (error) {
      setError(error.message);

      return;
    }

    if (assignmentEmployee) {
      await openAssignments(assignmentEmployee);
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);

    setError("");

    const [employeeResult, podResult] = await Promise.all([
      supabase.from("employees").select("*").order("full_name"),

      supabase.from("pods").select("id, name").order("name"),
    ]);

    if (employeeResult.error) {
      setError(employeeResult.error.message);

      setEmployees([]);
    } else {
      setEmployees(employeeResult.data ?? []);
    }

    if (podResult.error) {
      setError(podResult.error.message);

      setPods([]);
    } else {
      setPods(podResult.data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm() {
    setFullName("");

    setEmployeeCode("");

    setEmail("");

    setPodId("");

    setWeeklyOffDays([0]);

    setEditingEmployee(null);

    setShowForm(false);
  }

  function openCreateForm() {
    resetForm();

    setShowForm(true);
  }

  function openEditForm(employee: Employee) {
    setEditingEmployee(employee);

    setFullName(employee.full_name);

    setEmployeeCode(employee.employee_code ?? "");

    setEmail(employee.email ?? "");

    setPodId(employee.pod_id ?? "");

    setWeeklyOffDays(employee.weekly_off_days ?? [0]);

    setShowForm(true);
  }

  function toggleWeeklyOff(day: number) {
    setWeeklyOffDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!fullName.trim()) {
      setError("Employee name is required.");

      return;
    }

    if (weeklyOffDays.length === 0) {
      setError("Select at least one weekly off day.");

      return;
    }

    setSaving(true);

    const employeeData = {
      full_name: fullName.trim(),

      employee_code: employeeCode.trim() || null,

      email: email.trim() || null,

      pod_id: podId || null,

      weekly_off_days: weeklyOffDays,
    };

    const result = editingEmployee
      ? await supabase

          .from("employees")

          .update(employeeData)

          .eq("id", editingEmployee.id)
      : await supabase.from("employees").insert(employeeData);

    if (result.error) {
      setError(result.error.message);

      setSaving(false);

      return;
    }

    setSaving(false);

    resetForm();

    await loadData();
  }

  async function toggleEmployeeStatus(employee: Employee) {
    const action = employee.is_active ? "deactivate" : "reactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${employee.full_name}?`,
    );

    if (!confirmed) return;

    const { error } = await supabase

      .from("employees")

      .update({ is_active: !employee.is_active })

      .eq("id", employee.id);

    if (error) {
      setError(error.message);

      return;
    }

    await loadData();
  }

  function getPodName(id: string | null) {
    return pods.find((pod) => pod.id === id)?.name ?? "Unassigned";
  }

  function getWeeklyOffLabel(days: number[]) {
    return days

      .map((day) => weekdays.find((item) => item.value === day)?.label)

      .filter(Boolean)

      .map((day) => day?.slice(0, 3))

      .join(", ");
  }

  const filteredEmployees = employees.filter((employee) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      employee.full_name.toLowerCase().includes(searchText) ||
      (employee.employee_code ?? "").toLowerCase().includes(searchText) ||
      (employee.email ?? "").toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && employee.is_active) ||
      (statusFilter === "inactive" && !employee.is_active);

    return matchesSearch && matchesStatus;
  });

  const activeCount = employees.filter((employee) => employee.is_active).length;

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKFORCE ORGANIZATION</span>

          <h1>Employees</h1>

          <p>Manage employees, their pods and individual availability rules.</p>
        </div>

        <button className="primary-button" onClick={openCreateForm}>
          <Plus size={17} />
          Add employee
        </button>
      </div>

      <div className="employee-summary">
        <div>
          <span>Total employees</span>

          <strong>{employees.length}</strong>
        </div>

        <div>
          <span>Active employees</span>

          <strong>{activeCount}</strong>
        </div>

        <div>
          <span>Inactive employees</span>

          <strong>{employees.length - activeCount}</strong>
        </div>
      </div>

      <div className="management-toolbar">
        <div className="search-box">
          <Search size={17} />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, ID or email..."
          />
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All employees</option>

          <option value="active">Active</option>

          <option value="inactive">Inactive</option>
        </select>

        <span className="record-count">{filteredEmployees.length} records</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading employees...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-management">
          <div className="empty-icon">
            <Users size={26} />
          </div>

          <h3>
            {search || statusFilter !== "all"
              ? "No matching employees"
              : "No employees added yet"}
          </h3>

          <p>Add your employees and organize them into operational pods.</p>

          {!search && statusFilter === "all" && (
            <button className="primary-button" onClick={openCreateForm}>
              <Plus size={16} />
              Add first employee
            </button>
          )}
        </div>
      ) : (
        <div className="employee-table-wrap">
          <table className="employee-table">
            <thead>
              <tr>
                <th>EMPLOYEE</th>

                <th>EMPLOYEE ID</th>

                <th>POD</th>

                <th>WEEKLY OFF</th>

                <th>STATUS</th>

                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="employee-name-cell">
                      <div className="employee-avatar">
                        {employee.full_name.charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <strong>{employee.full_name}</strong>

                        <span>{employee.email || "No email provided"}</span>
                      </div>
                    </div>
                  </td>

                  <td>{employee.employee_code || "—"}</td>

                  <td>
                    <span className="pod-tag">
                      {getPodName(employee.pod_id)}
                    </span>
                  </td>

                  <td>{getWeeklyOffLabel(employee.weekly_off_days)}</td>

                  <td>
                    <span
                      className={`status-tag ${
                        employee.is_active ? "status-active" : "status-inactive"
                      }`}
                    >
                      {employee.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        className="secondary-button compact-button"
                        onClick={() => void openAssignments(employee)}
                      >
                        Assignments
                      </button>

                      <button
                        className="small-icon-button"
                        onClick={() => openEditForm(employee)}
                        title="Edit employee"
                        aria-label={`Edit ${employee.full_name}`}
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        className="secondary-button compact-button"
                        onClick={() => void toggleEmployeeStatus(employee)}
                      >
                        {employee.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onMouseDown={resetForm}>
          <form
            className="modal-card employee-modal"
            onSubmit={handleSubmit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{editingEmployee ? "Edit employee" : "Add employee"}</h2>

                <p>Enter employee details and working preferences.</p>
              </div>

              <button
                type="button"
                className="small-icon-button"
                onClick={resetForm}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <label htmlFor="employee-name">Full name *</label>

            <input
              id="employee-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="e.g. Rahul Sharma"
              required
            />

            <label htmlFor="employee-code">Employee ID</label>

            <input
              id="employee-code"
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              placeholder="e.g. DS001"
            />

            <label htmlFor="employee-email">Email address</label>

            <input
              id="employee-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="employee@company.com"
            />

            <label htmlFor="employee-pod">Pod assignment</label>

            <select
              id="employee-pod"
              value={podId}
              onChange={(event) => setPodId(event.target.value)}
            >
              <option value="">Unassigned</option>

              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name}
                </option>
              ))}
            </select>

            <label>Weekly off days *</label>

            <div className="weekday-options">
              {weekdays.map((day) => (
                <label
                  key={day.value}
                  className={`weekday-option ${
                    weeklyOffDays.includes(day.value) ? "selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={weeklyOffDays.includes(day.value)}
                    onChange={() => toggleWeeklyOff(day.value)}
                  />

                  {day.label.slice(0, 3)}
                </label>
              ))}
            </div>

            <p className="form-hint">
              Select every recurring weekly off day. These are employee
              availability rules, separate from brand operating calendars.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel
              </button>

              <button className="primary-button" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingEmployee
                    ? "Save changes"
                    : "Add employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      {assignmentEmployee && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setAssignmentEmployee(null)}
        >
          <div
            className="modal-card"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Process assignments</h2>

                <p>
                  Manage the brands and processes assigned to{" "}
                  {assignmentEmployee.full_name}.
                </p>
              </div>

              <button
                className="small-icon-button"
                onClick={() => setAssignmentEmployee(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {assignmentLoading ? (
              <p>Loading assignments...</p>
            ) : (
              <>
                <label htmlFor="assignment-process">Add brand/process</label>

                <select
                  id="assignment-process"
                  value={selectedProcessId}
                  onChange={(event) => setSelectedProcessId(event.target.value)}
                >
                  <option value="">Select a process</option>

                  {availableProcesses.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.brands?.name ?? "Unknown brand"} —{" "}
                      {option.processes?.name ?? "Unknown process"}
                    </option>
                  ))}
                </select>

                <button
                  className="primary-button"
                  style={{ alignSelf: "flex-start" }}
                  disabled={!selectedProcessId}
                  onClick={() => void addEmployeeAssignment()}
                >
                  <Plus size={15} />
                  Add assignment
                </button>

                <div className="assignment-list">
                  <strong>Current assignments</strong>

                  {employeeAssignments.length === 0 ? (
                    <p className="form-hint">No assignments yet.</p>
                  ) : (
                    employeeAssignments.map((assignment) => {
                      const option = availableProcesses.find(
                        (item) => item.id === assignment.brand_process_id,
                      );

                      return (
                        <div className="assignment-row" key={assignment.id}>
                          <span>
                            {option?.brands?.name ?? "Brand"} —{" "}
                            {option?.processes?.name ?? "Process"}
                          </span>

                          <button
                            className="small-icon-button danger-action"
                            onClick={() =>
                              void removeEmployeeAssignment(assignment)
                            }
                            title="Remove assignment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getRelatedName(value: RelatedName): { name: string } | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
