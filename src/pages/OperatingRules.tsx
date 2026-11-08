import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Trash2, RefreshCw, CalendarDays } from "lucide-react";
import { supabase } from "../lib/supabase";

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
  min_staff: number;
  is_active: boolean;
};

type ProcessDayRule = {
  id: string;
  brand_process_id: string;
  weekday: number;
  is_operating_day: boolean;
  min_staff: number | null;
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

export default function OperatingRules() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [brandProcesses, setBrandProcesses] = useState<BrandProcess[]>([]);
  const [rules, setRules] = useState<ProcessDayRule[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedProcess, setSelectedProcess] = useState("");
  const [selectedWeekday, setSelectedWeekday] = useState("1");
  const [isOperating, setIsOperating] = useState(true);
  const [minimumStaff, setMinimumStaff] = useState("");

  const [editingRule, setEditingRule] = useState<ProcessDayRule | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [brandResult, processResult, configResult, ruleResult] =
      await Promise.all([
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("processes").select("id, name").order("name"),
        supabase
          .from("brand_processes")
          .select("id, brand_id, process_id, min_staff, is_active")
          .eq("is_active", true),
        supabase
          .from("process_day_rules")
          .select("id, brand_process_id, weekday, is_operating_day, min_staff")
          .order("weekday"),
      ]);

    const failed = [brandResult, processResult, configResult, ruleResult].find(
      (result) => result.error,
    );

    if (failed?.error) {
      setError(failed.error.message);
    } else {
      setBrands(brandResult.data ?? []);
      setProcesses(processResult.data ?? []);
      setBrandProcesses(configResult.data ?? []);
      setRules(ruleResult.data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function getProcessLabel(config: BrandProcess): string {
    const brand = brands.find((item) => item.id === config.brand_id);
    const process = processes.find((item) => item.id === config.process_id);

    return `${brand?.name ?? "Unknown brand"} — ${process?.name ?? "Unknown process"}`;
  }

  function resetForm() {
    setSelectedProcess("");
    setSelectedWeekday("1");
    setIsOperating(true);
    setMinimumStaff("");
    setEditingRule(null);
  }

  function openEdit(rule: ProcessDayRule) {
    setEditingRule(rule);
    setSelectedProcess(rule.brand_process_id);
    setSelectedWeekday(String(rule.weekday));
    setIsOperating(rule.is_operating_day);
    setMinimumStaff(rule.min_staff === null ? "" : String(rule.min_staff));
    setError("");
    setSuccess("");
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProcess) {
      setError("Select a brand process.");
      return;
    }

    const weekday = Number(selectedWeekday);

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      setError("Select a valid weekday.");
      return;
    }

    let staffValue: number | null = null;

    if (minimumStaff.trim() !== "") {
      staffValue = Number(minimumStaff);

      if (!Number.isInteger(staffValue) || staffValue < 0) {
        setError("Minimum staffing must be a non-negative whole number.");
        return;
      }
    }

    if (isOperating && staffValue === 0) {
      setError(
        "An operating process must require at least one employee. Leave the field blank to use its default minimum.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const values = {
      brand_process_id: selectedProcess,
      weekday,
      is_operating_day: isOperating,
      min_staff: staffValue,
    };

    const result = editingRule
      ? await supabase
          .from("process_day_rules")
          .update(values)
          .eq("id", editingRule.id)
      : await supabase.from("process_day_rules").insert(values);

    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "A rule already exists for this process and weekday. Edit the existing rule instead."
          : result.error.message,
      );
      setSaving(false);
      return;
    }

    setSuccess(
      editingRule ? "Rule updated successfully." : "Rule added successfully.",
    );
    resetForm();
    setSaving(false);
    await loadData();
  }

  async function deleteRule(rule: ProcessDayRule) {
    const label = getProcessLabel(
      brandProcesses.find((item) => item.id === rule.brand_process_id)!,
    );

    const weekday = weekdays.find((day) => day.value === rule.weekday)?.label;

    if (!window.confirm(`Delete the ${weekday} rule for ${label}?`)) {
      return;
    }

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("process_day_rules")
      .delete()
      .eq("id", rule.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingRule?.id === rule.id) {
      resetForm();
    }

    setSuccess(
      "Rule deleted. The process will use its default settings for that weekday.",
    );
    await loadData();
  }

  const sortedRules = [...rules].sort((a, b) => {
    const processA = getProcessLabel(
      brandProcesses.find((item) => item.id === a.brand_process_id)!,
    );

    const processB = getProcessLabel(
      brandProcesses.find((item) => item.id === b.brand_process_id)!,
    );

    return processA.localeCompare(processB) || a.weekday - b.weekday;
  });

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SCHEDULING CONFIGURATION</span>
          <h1>Operating Rules</h1>
          <p>
            Configure weekday-specific operating calendars and staffing
            requirements for each brand process.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <section className="panel operating-rules-panel">
        <div className="panel-heading">
          <div>
            <h2>{editingRule ? "Edit weekday rule" : "Add weekday rule"}</h2>
            <p>
              A rule overrides the default operating day and/or minimum staffing
              for one weekday.
            </p>
          </div>
          <CalendarDays size={20} className="muted-icon" />
        </div>

        <form className="operating-rule-form" onSubmit={saveRule}>
          <div className="operating-rule-fields">
            <div>
              <label htmlFor="rule-process">Brand process</label>
              <select
                id="rule-process"
                value={selectedProcess}
                onChange={(event) => setSelectedProcess(event.target.value)}
                required
              >
                <option value="">Select a brand process</option>
                {brandProcesses.map((config) => (
                  <option key={config.id} value={config.id}>
                    {getProcessLabel(config)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rule-weekday">Weekday</label>
              <select
                id="rule-weekday"
                value={selectedWeekday}
                onChange={(event) => setSelectedWeekday(event.target.value)}
              >
                {weekdays.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="rule-minimum">Minimum employees</label>
              <input
                id="rule-minimum"
                type="number"
                min="0"
                step="1"
                value={minimumStaff}
                onChange={(event) => setMinimumStaff(event.target.value)}
                placeholder="Use default"
                disabled={!isOperating}
              />
            </div>
          </div>

          <label className="holiday-option operating-rule-toggle">
            <input
              type="checkbox"
              checked={isOperating}
              onChange={(event) => setIsOperating(event.target.checked)}
            />
            This process operates on this weekday
          </label>

          <p className="form-hint">
            Leave minimum employees blank to inherit the process's default
            minimum. Uncheck operating to explicitly close the process on this
            weekday. If you delete a rule, the default operating days and
            minimum staffing apply again.
          </p>

          <div className="modal-actions">
            {editingRule && (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel edit
              </button>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={saving || brandProcesses.length === 0}
            >
              {saving ? "Saving..." : editingRule ? "Update rule" : "Add rule"}
            </button>
          </div>
        </form>
      </section>

      <div className="management-toolbar">
        <strong>Configured weekday rules</strong>
        <span className="record-count">{rules.length} rules</span>
      </div>

      {loading ? (
        <div className="loading-state">Loading operating rules...</div>
      ) : brandProcesses.length === 0 ? (
        <div className="empty-management">
          <div className="empty-icon">
            <CalendarDays size={26} />
          </div>
          <h3>No active brand processes</h3>
          <p>
            Create a brand and configure at least one process before adding
            weekday rules.
          </p>
        </div>
      ) : rules.length === 0 ? (
        <div className="empty-management">
          <div className="empty-icon">
            <CalendarDays size={26} />
          </div>
          <h3>No weekday overrides yet</h3>
          <p>
            All processes currently use their default operating days and minimum
            staffing.
          </p>
        </div>
      ) : (
        <div className="employee-table-wrap">
          <table className="employee-table">
            <thead>
              <tr>
                <th>Brand / Process</th>
                <th>Weekday</th>
                <th>Operation</th>
                <th>Minimum staff</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {sortedRules.map((rule) => {
                const config = brandProcesses.find(
                  (item) => item.id === rule.brand_process_id,
                );

                const weekday = weekdays.find(
                  (day) => day.value === rule.weekday,
                );

                return (
                  <tr key={rule.id}>
                    <td>
                      <strong>
                        {config ? getProcessLabel(config) : "Unknown process"}
                      </strong>
                    </td>

                    <td>{weekday?.label ?? "Unknown"}</td>

                    <td>
                      <span
                        className={`status-tag ${
                          rule.is_operating_day
                            ? "status-active"
                            : "status-inactive"
                        }`}
                      >
                        {rule.is_operating_day ? "Operating" : "Closed"}
                      </span>
                    </td>

                    <td>
                      {rule.is_operating_day
                        ? (rule.min_staff ??
                          `Default (${config?.min_staff ?? 0})`)
                        : "—"}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          className="small-icon-button"
                          title="Edit rule"
                          onClick={() => openEdit(rule)}
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          className="small-icon-button danger-action"
                          title="Delete rule"
                          onClick={() => void deleteRule(rule)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
