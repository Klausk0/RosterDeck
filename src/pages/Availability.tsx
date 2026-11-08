import { useEffect, useState } from "react";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { supabase } from "../lib/supabase";

type Employee = {
  id: string;
  full_name: string;
  employee_code: string;
};

type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
};

type Leave = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: "leave" | "comp_off";
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  employees: { full_name: string } | null;
};

type AvailabilityException = {
  id: string;
  employee_id: string;
  availability_date: string;
  is_available: boolean;
  reason: string | null;
  employees: { full_name: string } | null;
};

export default function Availability() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");

  const [leaveEmployee, setLeaveEmployee] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveType, setLeaveType] = useState<"leave" | "comp_off">("leave");
  const [leaveReason, setLeaveReason] = useState("");

  const [exceptionEmployee, setExceptionEmployee] = useState("");
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionAvailable, setExceptionAvailable] = useState("false");
  const [exceptionReason, setExceptionReason] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [employeeResult, holidayResult, leaveResult, exceptionResult] =
      await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, employee_code")
          .eq("is_active", true)
          .order("full_name"),

        supabase.from("holidays").select("*").order("holiday_date"),

        supabase
          .from("leaves")
          .select("*, employees(full_name)")
          .order("start_date", { ascending: false }),

        supabase
          .from("employee_availability")
          .select("*, employees(full_name)")
          .order("availability_date", { ascending: false }),
      ]);

    const firstError =
      employeeResult.error ??
      holidayResult.error ??
      leaveResult.error ??
      exceptionResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setEmployees(employeeResult.data ?? []);
      setHolidays(holidayResult.data ?? []);
      setLeaves((leaveResult.data ?? []) as Leave[]);
      setExceptions((exceptionResult.data ?? []) as AvailabilityException[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function showSuccess(message: string) {
    setSuccess(message);
    setError("");
    window.setTimeout(() => setSuccess(""), 2500);
  }

  async function addHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { error } = await supabase.from("holidays").insert({
      name: holidayName.trim(),
      holiday_date: holidayDate,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setHolidayName("");
    setHolidayDate("");
    await loadData();
    showSuccess("Public holiday added.");
  }

  async function deleteHoliday(id: string) {
    if (!window.confirm("Delete this public holiday?")) return;

    const { error } = await supabase.from("holidays").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadData();
    showSuccess("Public holiday deleted.");
  }

  async function addLeave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (leaveEnd < leaveStart) {
      setError("The end date cannot be before the start date.");
      return;
    }

    const { error } = await supabase.from("leaves").insert({
      employee_id: leaveEmployee,
      start_date: leaveStart,
      end_date: leaveEnd,
      leave_type: leaveType,
      status: "approved",
      reason: leaveReason.trim() || null,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setLeaveEmployee("");
    setLeaveStart("");
    setLeaveEnd("");
    setLeaveReason("");
    await loadData();
    showSuccess("Approved leave/comp-off added.");
  }

  async function updateLeaveStatus(
    id: string,
    status: "approved" | "rejected",
  ) {
    const { error } = await supabase
      .from("leaves")
      .update({ status })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadData();
    showSuccess(`Leave ${status}.`);
  }

  async function deleteLeave(id: string) {
    if (!window.confirm("Delete this leave record?")) return;

    const { error } = await supabase.from("leaves").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadData();
    showSuccess("Leave record deleted.");
  }

  async function addException(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { error } = await supabase.from("employee_availability").insert({
      employee_id: exceptionEmployee,
      availability_date: exceptionDate,
      is_available: exceptionAvailable === "true",
      reason: exceptionReason.trim() || null,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setExceptionEmployee("");
    setExceptionDate("");
    setExceptionAvailable("false");
    setExceptionReason("");
    await loadData();
    showSuccess("Availability exception added.");
  }

  async function deleteException(id: string) {
    if (!window.confirm("Delete this availability exception?")) return;

    const { error } = await supabase
      .from("employee_availability")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadData();
    showSuccess("Availability exception deleted.");
  }

  if (loading) {
    return <div className="page-loading">Loading availability records...</div>;
  }

  return (
    <div className="page-content availability-page">
      <div className="page-heading">
        <div>
          <h1>Availability</h1>
          <p>
            Manage public holidays, employee leave and date-specific changes.
          </p>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="content-card availability-section">
        <div className="section-heading">
          <div>
            <h2>Public holidays</h2>
            <p>
              Process operating rules determine whether these dates are
              excluded.
            </p>
          </div>
          <CalendarDays size={20} />
        </div>

        <form className="availability-form" onSubmit={addHoliday}>
          <div className="form-field">
            <label>Holiday name</label>
            <input
              value={holidayName}
              onChange={(event) => setHolidayName(event.target.value)}
              placeholder="e.g. Diwali"
              required
            />
          </div>

          <div className="form-field">
            <label>Date</label>
            <input
              type="date"
              value={holidayDate}
              onChange={(event) => setHolidayDate(event.target.value)}
              required
            />
          </div>

          <button className="primary-button" type="submit">
            <Plus size={15} /> Add holiday
          </button>
        </form>

        <div className="simple-record-list">
          {holidays.length === 0 ? (
            <p className="empty-message">No public holidays added.</p>
          ) : (
            holidays.map((holiday) => (
              <div className="simple-record-row" key={holiday.id}>
                <div>
                  <strong>{holiday.name}</strong>
                  <span>{holiday.holiday_date}</span>
                </div>
                <button
                  className="small-icon-button danger-action"
                  onClick={() => void deleteHoliday(holiday.id)}
                  title="Delete holiday"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="content-card availability-section">
        <div className="section-heading">
          <div>
            <h2>Leave and comp-off</h2>
            <p>
              Approved records make an employee unavailable during the selected
              dates.
            </p>
          </div>
        </div>

        <form className="availability-form leave-form" onSubmit={addLeave}>
          <div className="form-field">
            <label>Employee</label>
            <select
              value={leaveEmployee}
              onChange={(event) => setLeaveEmployee(event.target.value)}
              required
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} ({employee.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Type</label>
            <select
              value={leaveType}
              onChange={(event) =>
                setLeaveType(event.target.value as "leave" | "comp_off")
              }
            >
              <option value="leave">Planned leave</option>
              <option value="comp_off">Comp-off</option>
            </select>
          </div>

          <div className="form-field">
            <label>Start date</label>
            <input
              type="date"
              value={leaveStart}
              onChange={(event) => setLeaveStart(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>End date</label>
            <input
              type="date"
              value={leaveEnd}
              onChange={(event) => setLeaveEnd(event.target.value)}
              min={leaveStart || undefined}
              required
            />
          </div>

          <div className="form-field">
            <label>Reason (optional)</label>
            <input
              value={leaveReason}
              onChange={(event) => setLeaveReason(event.target.value)}
              placeholder="Reason"
            />
          </div>

          <button className="primary-button" type="submit">
            <Plus size={15} /> Add approved record
          </button>
        </form>

        <div className="simple-record-list">
          {leaves.length === 0 ? (
            <p className="empty-message">No leave records added.</p>
          ) : (
            leaves.map((leave) => (
              <div className="simple-record-row leave-record" key={leave.id}>
                <div>
                  <strong>
                    {leave.employees?.full_name ?? "Unknown employee"} —{" "}
                    {leave.leave_type === "leave" ? "Leave" : "Comp-off"}
                  </strong>
                  <span>
                    {leave.start_date} to {leave.end_date}
                    {leave.reason ? ` · ${leave.reason}` : ""}
                  </span>
                  <span className={`status-label status-${leave.status}`}>
                    {leave.status}
                  </span>
                </div>

                <div className="record-actions">
                  {leave.status !== "approved" && (
                    <button
                      className="secondary-button compact-button"
                      onClick={() =>
                        void updateLeaveStatus(leave.id, "approved")
                      }
                    >
                      Approve
                    </button>
                  )}
                  {leave.status !== "rejected" && (
                    <button
                      className="secondary-button compact-button"
                      onClick={() =>
                        void updateLeaveStatus(leave.id, "rejected")
                      }
                    >
                      Reject
                    </button>
                  )}
                  <button
                    className="small-icon-button danger-action"
                    onClick={() => void deleteLeave(leave.id)}
                    title="Delete leave"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="content-card availability-section">
        <div className="section-heading">
          <div>
            <h2>Date-specific availability</h2>
            <p>
              Override an employee's normal weekly-off pattern for one date.
            </p>
          </div>
        </div>

        <form className="availability-form" onSubmit={addException}>
          <div className="form-field">
            <label>Employee</label>
            <select
              value={exceptionEmployee}
              onChange={(event) => setExceptionEmployee(event.target.value)}
              required
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} ({employee.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Date</label>
            <input
              type="date"
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Availability</label>
            <select
              value={exceptionAvailable}
              onChange={(event) => setExceptionAvailable(event.target.value)}
            >
              <option value="false">Unavailable</option>
              <option value="true">Available</option>
            </select>
          </div>

          <div className="form-field">
            <label>Reason (optional)</label>
            <input
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
              placeholder="Reason"
            />
          </div>

          <button className="primary-button" type="submit">
            <Plus size={15} /> Add exception
          </button>
        </form>

        <div className="simple-record-list">
          {exceptions.length === 0 ? (
            <p className="empty-message">No date-specific exceptions added.</p>
          ) : (
            exceptions.map((exception) => (
              <div className="simple-record-row" key={exception.id}>
                <div>
                  <strong>
                    {exception.employees?.full_name ?? "Unknown employee"}
                  </strong>
                  <span>
                    {exception.availability_date}
                    {exception.reason ? ` · ${exception.reason}` : ""}
                  </span>
                  <span
                    className={`status-label ${
                      exception.is_available
                        ? "status-approved"
                        : "status-rejected"
                    }`}
                  >
                    {exception.is_available ? "Available" : "Unavailable"}
                  </span>
                </div>
                <button
                  className="small-icon-button danger-action"
                  onClick={() => void deleteException(exception.id)}
                  title="Delete exception"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
