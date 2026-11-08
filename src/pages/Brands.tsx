import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Settings2,
  Users,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type Brand = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Process = {
  id: string;
  name: string;
};

type BrandProcess = {
  id: string;
  brand_id: string;
  process_id: string;
  operating_days: number[];
  min_staff: number;
  exclude_public_holidays: boolean;
  shift_start: string;
  shift_end: string;
  is_active: boolean;
};

type Employee = {
  id: string;
  employee_code: string | null;
  full_name: string;
  pod_id: string | null;
  is_active: boolean;
};

type Pod = {
  id: string;
  name: string;
};

type Assignment = {
  id: string;
  employee_id: string;
  brand_process_id: string;
};

const weekdays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [brandProcesses, setBrandProcesses] = useState<BrandProcess[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showBrandForm, setShowBrandForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandName, setBrandName] = useState("");
  const [description, setDescription] = useState("");

  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [editingConfig, setEditingConfig] = useState<BrandProcess | null>(null);

  const [processName, setProcessName] = useState("Customer Support");
  const [operatingDays, setOperatingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [minStaff, setMinStaff] = useState(1);
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");

  const [selectedEmployees, setSelectedEmployees] = useState<
    Record<string, string>
  >({});

  const [saving, setSaving] = useState(false);

  // Load all management data.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      brandResult,
      processResult,
      configResult,
      employeeResult,
      podResult,
      assignmentResult,
    ] = await Promise.all([
      supabase.from("brands").select("*").order("name"),

      supabase.from("processes").select("*").order("name"),

      supabase
        .from("brand_processes")
        .select(
          "id, brand_id, process_id, operating_days, min_staff, exclude_public_holidays, shift_start, shift_end, is_active",
        ),

      supabase
        .from("employees")
        .select("id, employee_code, full_name, pod_id, is_active")
        .order("full_name"),

      supabase.from("pods").select("id, name").order("name"),

      supabase.from("assignments").select("id, employee_id, brand_process_id"),
    ]);

    const errors = [
      brandResult.error,
      processResult.error,
      configResult.error,
      employeeResult.error,
      podResult.error,
      assignmentResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      setError(errors.map((item) => item?.message).join(" | "));
    }

    setBrands(brandResult.data ?? []);
    setProcesses(processResult.data ?? []);
    setBrandProcesses((configResult.data ?? []) as BrandProcess[]);
    setEmployees(employeeResult.data ?? []);
    setPods(podResult.data ?? []);
    setAssignments(assignmentResult.data ?? []);

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Brand management.
  function openCreateBrand() {
    setEditingBrand(null);
    setBrandName("");
    setDescription("");
    setShowBrandForm(true);
  }

  function openEditBrand(brand: Brand) {
    setEditingBrand(brand);
    setBrandName(brand.name);
    setDescription(brand.description ?? "");
    setShowBrandForm(true);
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!brandName.trim()) {
      setError("Brand name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const values = {
      name: brandName.trim(),
      description: description.trim() || null,
    };

    const result = editingBrand
      ? await supabase.from("brands").update(values).eq("id", editingBrand.id)
      : await supabase.from("brands").insert(values);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowBrandForm(false);
    setEditingBrand(null);

    await loadData();
  }

  async function deleteBrand(brand: Brand) {
    const confirmed = window.confirm(
      `Delete ${brand.name} and its process configurations?`,
    );

    if (!confirmed) return;

    setError("");

    const { error } = await supabase.from("brands").delete().eq("id", brand.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadData();
  }

  // Process configuration management.
  function resetProcessForm() {
    setProcessName("Customer Support");
    setOperatingDays([1, 2, 3, 4, 5]);
    setMinStaff(1);
    setExcludeHolidays(true);
    setShiftStart("09:00");
    setShiftEnd("18:00");
    setEditingConfig(null);
  }

  function openAddProcess(brand: Brand) {
    resetProcessForm();
    setSelectedBrand(brand);
  }

  function openEditProcess(brand: Brand, config: BrandProcess) {
    setSelectedBrand(brand);
    setEditingConfig(config);

    const process = processes.find((item) => item.id === config.process_id);

    setProcessName(process?.name ?? "");
    setOperatingDays(config.operating_days ?? []);
    setMinStaff(config.min_staff ?? 1);
    setExcludeHolidays(config.exclude_public_holidays ?? true);
    setShiftStart(config.shift_start?.slice(0, 5) ?? "09:00");
    setShiftEnd(config.shift_end?.slice(0, 5) ?? "18:00");
  }

  function toggleDay(day: number) {
    setOperatingDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  async function getOrCreateProcess(name: string): Promise<Process | null> {
    const existing = processes.find(
      (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
    );

    if (existing) return existing;

    const { data, error } = await supabase
      .from("processes")
      .insert({ name: name.trim() })
      .select("id, name")
      .single();

    if (error || !data) {
      setError(error?.message ?? "Could not create process.");
      return null;
    }

    return data;
  }

  async function saveProcess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedBrand) return;

    if (!processName.trim()) {
      setError("Process name is required.");
      return;
    }

    if (operatingDays.length === 0) {
      setError("Select at least one operating day.");
      return;
    }

    if (minStaff < 1 || !Number.isInteger(minStaff)) {
      setError("Minimum staffing must be at least 1.");
      return;
    }

    if (!shiftStart || !shiftEnd || shiftStart >= shiftEnd) {
      setError("Shift end time must be later than shift start time.");
      return;
    }

    setSaving(true);
    setError("");

    const process = await getOrCreateProcess(processName);

    if (!process) {
      setSaving(false);
      return;
    }

    const values = {
      brand_id: selectedBrand.id,
      process_id: process.id,
      operating_days: operatingDays,
      min_staff: minStaff,
      exclude_public_holidays: excludeHolidays,
      shift_start: shiftStart,
      shift_end: shiftEnd,
    };

    const result = editingConfig
      ? await supabase
          .from("brand_processes")
          .update(values)
          .eq("id", editingConfig.id)
      : await supabase.from("brand_processes").insert(values);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSelectedBrand(null);
    resetProcessForm();

    await loadData();
  }

  async function removeProcess(config: BrandProcess) {
    const confirmed = window.confirm(
      "Remove this process from the brand? Its employee assignments will also be affected if your database uses cascading deletes.",
    );

    if (!confirmed) return;

    setError("");

    const { error } = await supabase
      .from("brand_processes")
      .delete()
      .eq("id", config.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadData();
  }

  // Employee assignment management.
  function getAssignedEmployees(configId: string) {
    return assignments
      .filter((item) => item.brand_process_id === configId)
      .map((assignment) => ({
        assignment,
        employee: employees.find(
          (employee) => employee.id === assignment.employee_id,
        ),
      }))
      .filter(
        (
          item,
        ): item is {
          assignment: Assignment;
          employee: Employee;
        } => Boolean(item.employee),
      );
  }

  function getPodName(podId: string | null) {
    if (!podId) return "No pod";

    return pods.find((pod) => pod.id === podId)?.name ?? "Unknown pod";
  }

  function getAvailableEmployees(configId: string) {
    const assignedIds = assignments
      .filter((item) => item.brand_process_id === configId)
      .map((item) => item.employee_id);

    return employees.filter(
      (employee) => employee.is_active && !assignedIds.includes(employee.id),
    );
  }

  async function addEmployee(config: BrandProcess) {
    const employeeId = selectedEmployees[config.id];

    if (!employeeId) {
      setError("Select an employee first.");
      return;
    }

    const alreadyAssigned = assignments.some(
      (item) =>
        item.employee_id === employeeId && item.brand_process_id === config.id,
    );

    if (alreadyAssigned) {
      setError("This employee is already assigned to this process.");
      return;
    }

    setError("");

    const { error } = await supabase.from("assignments").insert({
      employee_id: employeeId,
      brand_process_id: config.id,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSelectedEmployees((current) => ({
      ...current,
      [config.id]: "",
    }));

    await loadData();
  }

  async function removeEmployee(assignment: Assignment) {
    const confirmed = window.confirm("Remove this employee from the process?");

    if (!confirmed) return;

    setError("");

    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignment.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadData();
  }

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLIENT OPERATIONS</span>
          <h1>Brands</h1>
          <p>Manage client brands, processes and coverage requirements.</p>
        </div>

        <button className="primary-button" onClick={openCreateBrand}>
          <Plus size={17} />
          Add brand
        </button>
      </div>

      <div className="management-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brands..."
          />
        </div>

        <span className="record-count">{brands.length} brands</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading brands...</div>
      ) : filteredBrands.length === 0 ? (
        <div className="empty-management">
          <div className="empty-icon">
            <Settings2 size={26} />
          </div>

          <h3>{search ? "No matching brands" : "No brands created yet"}</h3>

          <p>Create a brand and configure its operational processes.</p>

          {!search && (
            <button className="primary-button" onClick={openCreateBrand}>
              <Plus size={16} /> Add first brand
            </button>
          )}
        </div>
      ) : (
        <div className="brand-grid">
          {filteredBrands.map((brand) => {
            const configs = brandProcesses.filter(
              (item) => item.brand_id === brand.id,
            );

            return (
              <article className="brand-card" key={brand.id}>
                <div className="brand-card-heading">
                  <div className="brand-initial">
                    {brand.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="brand-actions">
                    <button
                      className="small-icon-button"
                      onClick={() => openEditBrand(brand)}
                      title="Edit brand"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      className="small-icon-button danger-action"
                      onClick={() => void deleteBrand(brand)}
                      title="Delete brand"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3>{brand.name}</h3>

                <p className="brand-description">
                  {brand.description || "No description"}
                </p>

                <div className="brand-process-heading">
                  <strong>Processes ({configs.length})</strong>

                  <button
                    className="text-button"
                    onClick={() => openAddProcess(brand)}
                  >
                    <Plus size={14} /> Add process
                  </button>
                </div>

                {configs.length === 0 ? (
                  <p className="no-processes">No processes configured.</p>
                ) : (
                  <div className="brand-process-list">
                    {configs.map((config) => {
                      const process = processes.find(
                        (item) => item.id === config.process_id,
                      );

                      const assigned = getAssignedEmployees(config.id);
                      const available = getAvailableEmployees(config.id);

                      return (
                        <div
                          className="brand-process-row"
                          key={config.id}
                          style={{
                            display: "block",
                            padding: "14px 0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "12px",
                            }}
                          >
                            <div>
                              <strong>
                                {process?.name ?? "Unnamed process"}
                              </strong>

                              <span style={{ display: "block" }}>
                                {config.operating_days
                                  .slice()
                                  .sort((a, b) => a - b)
                                  .map(
                                    (day) =>
                                      weekdays.find(
                                        (item) => item.value === day,
                                      )?.label,
                                  )
                                  .filter(Boolean)
                                  .join(", ")}
                                {" · "}
                                Minimum {config.min_staff}
                              </span>

                              <span style={{ display: "block" }}>
                                Shift: {config.shift_start?.slice(0, 5)} –{" "}
                                {config.shift_end?.slice(0, 5)}
                              </span>

                              <span style={{ display: "block" }}>
                                {config.exclude_public_holidays
                                  ? "Public holidays off"
                                  : "Operates on public holidays"}
                              </span>
                            </div>

                            <div className="table-actions">
                              <button
                                className="small-icon-button"
                                onClick={() => openEditProcess(brand, config)}
                                title="Edit process configuration"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                className="small-icon-button danger-action"
                                onClick={() => void removeProcess(config)}
                                title="Remove process"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: "14px",
                              borderTop:
                                "1px solid var(--border-color, #e5e7eb)",
                              paddingTop: "12px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "10px",
                              }}
                            >
                              <strong
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Users size={15} />
                                Assigned employees ({assigned.length})
                              </strong>
                            </div>

                            {assigned.length === 0 ? (
                              <p className="form-hint">
                                No employees assigned to this process yet.
                              </p>
                            ) : (
                              <div className="assignment-list">
                                {assigned.map(({ assignment, employee }) => (
                                  <div
                                    className="assignment-row"
                                    key={assignment.id}
                                  >
                                    <span>
                                      <strong>{employee.full_name}</strong>
                                      <span
                                        style={{
                                          display: "block",
                                          fontSize: "12px",
                                          opacity: 0.7,
                                        }}
                                      >
                                        {employee.employee_code || "No ID"} ·{" "}
                                        {getPodName(employee.pod_id)}
                                      </span>
                                    </span>

                                    <button
                                      className="small-icon-button danger-action"
                                      onClick={() =>
                                        void removeEmployee(assignment)
                                      }
                                      title="Remove employee assignment"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                marginTop: "12px",
                                alignItems: "center",
                              }}
                            >
                              <select
                                className="filter-select"
                                style={{ flex: 1, minWidth: 0 }}
                                value={selectedEmployees[config.id] ?? ""}
                                onChange={(event) =>
                                  setSelectedEmployees((current) => ({
                                    ...current,
                                    [config.id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Select employee...</option>

                                {available.map((employee) => (
                                  <option key={employee.id} value={employee.id}>
                                    {employee.full_name}
                                    {employee.employee_code
                                      ? ` (${employee.employee_code})`
                                      : ""}
                                  </option>
                                ))}
                              </select>

                              <button
                                className="secondary-button compact-button"
                                disabled={!selectedEmployees[config.id]}
                                onClick={() => void addEmployee(config)}
                              >
                                <Plus size={14} />
                                Assign
                              </button>
                            </div>

                            {available.length === 0 && (
                              <p className="form-hint">
                                All active employees are already assigned here,
                                or no active employees exist.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Create/Edit Brand Modal */}
      {showBrandForm && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowBrandForm(false)}
        >
          <form
            className="modal-card"
            onSubmit={saveBrand}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{editingBrand ? "Edit brand" : "Create brand"}</h2>
                <p>Enter the client's basic information.</p>
              </div>

              <button
                type="button"
                className="small-icon-button"
                onClick={() => setShowBrandForm(false)}
              >
                <X size={19} />
              </button>
            </div>

            <label htmlFor="brand-name">Brand name *</label>
            <input
              id="brand-name"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              placeholder="e.g. Boat"
              required
            />

            <label htmlFor="brand-description">Description</label>
            <input
              id="brand-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
            />

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowBrandForm(false)}
              >
                Cancel
              </button>

              <button className="primary-button" disabled={saving}>
                {saving ? "Saving..." : "Save brand"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Process Modal */}
      {selectedBrand && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            setSelectedBrand(null);
            resetProcessForm();
          }}
        >
          <form
            className="modal-card"
            onSubmit={saveProcess}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{editingConfig ? "Edit process" : "Add a process"}</h2>

                <p>Configure requirements for {selectedBrand.name}.</p>
              </div>

              <button
                type="button"
                className="small-icon-button"
                onClick={() => {
                  setSelectedBrand(null);
                  resetProcessForm();
                }}
              >
                <X size={19} />
              </button>
            </div>

            <label htmlFor="process-name">Process *</label>

            <input
              id="process-name"
              list="process-options"
              value={processName}
              onChange={(event) => setProcessName(event.target.value)}
              required
              placeholder="e.g. Customer Support"
            />

            <datalist id="process-options">
              {processes.map((process) => (
                <option key={process.id} value={process.name} />
              ))}

              <option value="Customer Support" />
              <option value="Abandoned Cart Conversions" />
              <option value="Retention" />
              <option value="NDR" />
            </datalist>

            <label>Operating days *</label>

            <div className="weekday-options">
              {weekdays.map((day) => (
                <label
                  key={day.value}
                  className={`weekday-option ${
                    operatingDays.includes(day.value) ? "selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={operatingDays.includes(day.value)}
                    onChange={() => toggleDay(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>

            <label htmlFor="min-staff">Minimum employees required *</label>

            <input
              id="min-staff"
              type="number"
              min="1"
              max="30"
              value={minStaff}
              onChange={(event) => setMinStaff(Number(event.target.value))}
              required
            />

            <label htmlFor="shift-start">Shift start time *</label>

            <input
              id="shift-start"
              type="time"
              value={shiftStart}
              onChange={(event) => setShiftStart(event.target.value)}
              required
            />

            <label htmlFor="shift-end">Shift end time *</label>

            <input
              id="shift-end"
              type="time"
              value={shiftEnd}
              onChange={(event) => setShiftEnd(event.target.value)}
              required
            />

            <label className="holiday-option">
              <input
                type="checkbox"
                checked={excludeHolidays}
                onChange={(event) => setExcludeHolidays(event.target.checked)}
              />
              Public holidays are off for this process
            </label>

            <p className="form-hint">
              Operating days belong to this brand-process combination, not to
              the individual employee. Shift timings determine when an employee
              can be assigned to multiple processes without overlap.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedBrand(null);
                  resetProcessForm();
                }}
              >
                Cancel
              </button>

              <button className="primary-button" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingConfig
                    ? "Save changes"
                    : "Add process"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
