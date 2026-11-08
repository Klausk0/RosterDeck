
export type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  weekly_off_days: number[];
  max_daily_assignments: number;
  is_active: boolean;
};

export type BrandProcess = {
  id: string;
  brand_id: string;
  process_id: string;
  operating_days: number[];
  min_staff: number;
  exclude_public_holidays: boolean;
  shift_start: string;
  shift_end: string;
  is_active: boolean;
  brands: { name: string } | null;
  processes: { name: string } | null;
};

export type Assignment = {
  employee_id: string;
  brand_process_id: string;
};

export type ProcessDayRule = {
  brand_process_id: string;
  weekday: number;
  is_operating_day: boolean;
  min_staff: number | null;
};

export type Holiday = {
  holiday_date: string;
};

export type LeaveRecord = {
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: "leave" | "comp_off";
  status: "pending" | "approved" | "rejected";
};

export type AvailabilityException = {
  employee_id: string;
  availability_date: string;
  is_available: boolean;
};

export type RosterAllocation = {
  date: string;
  employee_id: string;
  brand_process_id: string;
  shift_start: string;
  shift_end: string;
};

export type RosterEntry = {
  date: string;
  employee_id: string;
  status: "working" | "off" | "leave" | "comp_off";
};

export type RosterConflict = {
  date: string;
  severity: "hard" | "soft";
  conflict_type:
    | "insufficient_staff"
    | "no_assigned_employees"
    | "no_available_employees"
    | "weekly_off_override";
  brand_process_id: string;
  message: string;
  required_staff: number;
  assigned_staff: number;
};

export type GenerationResult = {
  entries: RosterEntry[];
  allocations: RosterAllocation[];
  conflicts: RosterConflict[];
};

export type GenerateRosterInput = {
  startDate: string;
  endDate: string;
  employees: Employee[];
  brandProcesses: BrandProcess[];
  assignments: Assignment[];
  processDayRules: ProcessDayRule[];
  holidays: Holiday[];
  leaves: LeaveRecord[];
  availabilityExceptions: AvailabilityException[];
};

type ProcessTask = {
  date: string;
  process: BrandProcess;
  requiredStaff: number;
  candidates: Employee[];
};

// --------------------------------------------------
// DATE UTILITIES
// --------------------------------------------------

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function getWeekday(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

// --------------------------------------------------
// TIME UTILITIES
// --------------------------------------------------

function timeToMinutes(time: string): number | null {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;

  const parts = time.split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  const seconds = parts[2] ?? 0;

  if (
    hours < 0 || hours > 23 ||
    minutes < 0 || minutes > 59 ||
    seconds < 0 || seconds > 59
  ) {
    return null;
  }

  return hours * 60 + minutes + seconds / 60;
}

function shiftsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  if (
    aStart === null || aEnd === null ||
    bStart === null || bEnd === null
  ) {
    return true;
  }

  return aStart < bEnd && bStart < aEnd;
}

// --------------------------------------------------
// INPUT VALIDATION
// --------------------------------------------------

function validateInput(input: GenerateRosterInput): void {
  if (
    !isValidDate(input.startDate) ||
    !isValidDate(input.endDate)
  ) {
    throw new Error("Invalid roster date. Use YYYY-MM-DD format.");
  }

  if (input.startDate > input.endDate) {
    throw new Error("The roster start date must be before or equal to its end date.");
  }

  const employeeIds = new Set<string>();

  for (const employee of input.employees) {
    if (!employee.id) throw new Error("Every employee must have an ID.");

    if (employeeIds.has(employee.id)) {
      throw new Error(`Duplicate employee ID: ${employee.id}`);
    }

    employeeIds.add(employee.id);

    if (
      !Number.isInteger(employee.max_daily_assignments) ||
      employee.max_daily_assignments < 0
    ) {
      throw new Error(`Invalid daily assignment limit for ${employee.full_name}.`);
    }

    if (
      employee.weekly_off_days.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    ) {
      throw new Error(`Invalid weekly off configuration for ${employee.full_name}.`);
    }
  }

  const processIds = new Set<string>();

  for (const process of input.brandProcesses) {
    if (!process.id) throw new Error("Every brand process must have an ID.");

    if (processIds.has(process.id)) {
      throw new Error(`Duplicate brand process ID: ${process.id}`);
    }

    processIds.add(process.id);

    if (!Number.isInteger(process.min_staff) || process.min_staff < 0) {
      throw new Error(
        `Invalid minimum staffing requirement for ${process.processes?.name ?? process.id}.`,
      );
    }

    if (
      process.operating_days.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    ) {
      throw new Error(
        `Invalid operating days for ${process.processes?.name ?? process.id}.`,
      );
    }

    const start = timeToMinutes(process.shift_start);
    const end = timeToMinutes(process.shift_end);

    if (start === null || end === null || end <= start) {
      throw new Error(`Invalid shift timing for ${process.processes?.name ?? process.id}.`);
    }
  }

  const ruleKeys = new Set<string>();

  for (const rule of input.processDayRules) {
    if (!processIds.has(rule.brand_process_id)) {
      throw new Error(`A weekday rule references an unknown brand process: ${rule.brand_process_id}`);
    }

    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
      throw new Error("A weekday rule contains an invalid weekday.");
    }

    if (
      rule.min_staff !== null &&
      (!Number.isInteger(rule.min_staff) || rule.min_staff < 0)
    ) {
      throw new Error("A weekday rule contains invalid minimum staffing.");
    }

    const key = `${rule.brand_process_id}-${rule.weekday}`;

    if (ruleKeys.has(key)) {
      throw new Error(`Duplicate weekday rule for process ${rule.brand_process_id}, weekday ${rule.weekday}.`);
    }

    ruleKeys.add(key);
  }

  for (const assignment of input.assignments) {
    if (!processIds.has(assignment.brand_process_id)) {
      throw new Error(`An assignment references an unknown brand process: ${assignment.brand_process_id}`);
    }

    if (!employeeIds.has(assignment.employee_id)) {
      throw new Error(`An assignment references an unknown employee: ${assignment.employee_id}`);
    }
  }
}

// --------------------------------------------------
// EMPLOYEE AVAILABILITY
// --------------------------------------------------

function isOnApprovedLeave(
  employeeId: string,
  date: string,
  leaves: LeaveRecord[],
): LeaveRecord | undefined {
  return leaves.find(
    (leave) =>
      leave.employee_id === employeeId &&
      leave.status === "approved" &&
      leave.start_date <= date &&
      leave.end_date >= date,
  );
}

function getAvailabilityException(
  employeeId: string,
  date: string,
  exceptions: AvailabilityException[],
): AvailabilityException | undefined {
  return exceptions.find(
    (item) =>
      item.employee_id === employeeId &&
      item.availability_date === date,
  );
}

function isEmployeeHardAvailable(
  employee: Employee,
  date: string,
  leaves: LeaveRecord[],
  exceptions: AvailabilityException[],
): boolean {
  if (!employee.is_active) return false;

  if (isOnApprovedLeave(employee.id, date, leaves)) return false;

  const exception = getAvailabilityException(
    employee.id,
    date,
    exceptions,
  );

  if (exception) return exception.is_available;

  // Weekly offs are deliberately NOT hard restrictions.
  return true;
}

function isOnWeeklyOff(employee: Employee, date: string): boolean {
  return employee.weekly_off_days.includes(getWeekday(date));
}

// --------------------------------------------------
// PROCESS REQUIREMENTS
// --------------------------------------------------

function getProcessRequirement(
  process: BrandProcess,
  date: string,
  rules: ProcessDayRule[],
  holidayDates: Set<string>,
): { operates: boolean; requiredStaff: number } {
  const weekday = getWeekday(date);

  const override = rules.find(
    (rule) =>
      rule.brand_process_id === process.id &&
      rule.weekday === weekday,
  );

  const operates = override
    ? override.is_operating_day
    : process.operating_days.includes(weekday);

  if (!operates) return { operates: false, requiredStaff: 0 };

  if (process.exclude_public_holidays && holidayDates.has(date)) {
    return { operates: false, requiredStaff: 0 };
  }

  return {
    operates: true,
    requiredStaff: Math.max(0, override?.min_staff ?? process.min_staff),
  };
}

// --------------------------------------------------
// EMPLOYEE ALLOCATION VALIDATION
// --------------------------------------------------

function canAssignEmployee(
  employee: Employee,
  process: BrandProcess,
  date: string,
  allocations: RosterAllocation[],
): boolean {
  const employeeAllocations = allocations.filter(
    (allocation) =>
      allocation.employee_id === employee.id &&
      allocation.date === date,
  );

  if (employeeAllocations.length >= employee.max_daily_assignments) {
    return false;
  }

  return !employeeAllocations.some((allocation) =>
    shiftsOverlap(
      process.shift_start,
      process.shift_end,
      allocation.shift_start,
      allocation.shift_end,
    ),
  );
}

function getDailyWorkload(
  employeeId: string,
  date: string,
  allocations: RosterAllocation[],
): number {
  return allocations.filter(
    (allocation) =>
      allocation.employee_id === employeeId &&
      allocation.date === date,
  ).length;
}

// --------------------------------------------------
// MAIN SCHEDULING ENGINE
// --------------------------------------------------

export function generateRoster(
  input: GenerateRosterInput,
): GenerationResult {
  validateInput(input);

  const dates = getDatesBetween(input.startDate, input.endDate);

  const activeProcesses = input.brandProcesses.filter(
    (process) => process.is_active,
  );

  const holidayDates = new Set(
    input.holidays.map((holiday) => holiday.holiday_date),
  );

  const allocations: RosterAllocation[] = [];
  const conflicts: RosterConflict[] = [];

  const assignmentsByProcess = new Map<string, Set<string>>();

  for (const assignment of input.assignments) {
    if (!assignmentsByProcess.has(assignment.brand_process_id)) {
      assignmentsByProcess.set(
        assignment.brand_process_id,
        new Set<string>(),
      );
    }

    assignmentsByProcess
      .get(assignment.brand_process_id)!
      .add(assignment.employee_id);
  }

  const employeesById = new Map(
    input.employees.map((employee) => [employee.id, employee]),
  );

  for (const date of dates) {
    const tasks: ProcessTask[] = [];

    // Build process requirements and hard-available candidates.
    for (const process of activeProcesses) {
      const requirement = getProcessRequirement(
        process,
        date,
        input.processDayRules,
        holidayDates,
      );

      if (!requirement.operates || requirement.requiredStaff === 0) {
        continue;
      }

      const assignedIds =
        assignmentsByProcess.get(process.id) ?? new Set<string>();

      const candidates = Array.from(assignedIds)
        .map((id) => employeesById.get(id))
        .filter(
          (employee): employee is Employee =>
            employee !== undefined &&
            isEmployeeHardAvailable(
              employee,
              date,
              input.leaves,
              input.availabilityExceptions,
            ),
        );

      tasks.push({
        date,
        process,
        requiredStaff: requirement.requiredStaff,
        candidates,
      });
    }

    // Scarcity first: prioritize tasks with fewer eligible resources.
    tasks.sort((a, b) => {
      if (a.candidates.length !== b.candidates.length) {
        return a.candidates.length - b.candidates.length;
      }

      if (a.requiredStaff !== b.requiredStaff) {
        return b.requiredStaff - a.requiredStaff;
      }

      return a.process.id.localeCompare(b.process.id);
    });

    for (const task of tasks) {
      const assignedIds =
        assignmentsByProcess.get(task.process.id) ?? new Set<string>();

      if (assignedIds.size === 0) {
        conflicts.push({
          date,
          severity: "hard",
          conflict_type: "no_assigned_employees",
          brand_process_id: task.process.id,
          message: `${task.process.brands?.name ?? "Brand"} — ${task.process.processes?.name ?? "Process"}: no employees have been assigned to this process.`,
          required_staff: task.requiredStaff,
          assigned_staff: 0,
        });
        continue;
      }

      // Prefer non-weekly-off employees, but use weekly-off employees
      // when needed to satisfy required client coverage.
      const eligibleCandidates = task.candidates
        .filter((employee) =>
          canAssignEmployee(
            employee,
            task.process,
            date,
            allocations,
          ),
        )
        .sort((a, b) => {
          const weeklyOffA = isOnWeeklyOff(a, date) ? 1 : 0;
          const weeklyOffB = isOnWeeklyOff(b, date) ? 1 : 0;

          if (weeklyOffA !== weeklyOffB) {
            return weeklyOffA - weeklyOffB;
          }

          const workloadA = getDailyWorkload(a.id, date, allocations);
          const workloadB = getDailyWorkload(b.id, date, allocations);

          if (workloadA !== workloadB) {
            return workloadA - workloadB;
          }

          return a.employee_code.localeCompare(b.employee_code);
        });

      const selectedEmployees = eligibleCandidates.slice(
        0,
        task.requiredStaff,
      );

      for (const employee of selectedEmployees) {
        allocations.push({
          date,
          employee_id: employee.id,
          brand_process_id: task.process.id,
          shift_start: task.process.shift_start,
          shift_end: task.process.shift_end,
        });

        if (isOnWeeklyOff(employee, date)) {
          conflicts.push({
            date,
            severity: "soft",
            conflict_type: "weekly_off_override",
            brand_process_id: task.process.id,
            message: `${employee.full_name} (${employee.employee_code}) was scheduled on their preferred weekly off to maintain ${task.process.brands?.name ?? "brand"} — ${task.process.processes?.name ?? "process"} coverage.`,
            required_staff: task.requiredStaff,
            assigned_staff: selectedEmployees.length,
          });
        }
      }

      if (selectedEmployees.length < task.requiredStaff) {
        const availableCount = task.candidates.length;

        const conflictType =
          availableCount === 0
            ? "no_available_employees"
            : "insufficient_staff";

        const reason =
          availableCount === 0
            ? "No assigned employees are available because of approved leave, explicit unavailability, or inactive status."
            : "Some assigned employees are unavailable, already allocated to overlapping shifts, or have reached their daily assignment limit.";

        conflicts.push({
          date,
          severity: "hard",
          conflict_type: conflictType,
          brand_process_id: task.process.id,
          message: `${task.process.brands?.name ?? "Brand"} — ${task.process.processes?.name ?? "Process"}: requires ${task.requiredStaff} employee(s), but only ${selectedEmployees.length} could be allocated. ${reason}`,
          required_staff: task.requiredStaff,
          assigned_staff: selectedEmployees.length,
        });
      }
    }
  }

  // Create one daily status entry per employee.
  const entries: RosterEntry[] = [];

  for (const date of dates) {
    for (const employee of input.employees) {
      const approvedLeave = isOnApprovedLeave(
        employee.id,
        date,
        input.leaves,
      );

      let status: RosterEntry["status"];

      if (approvedLeave?.leave_type === "comp_off") {
        status = "comp_off";
      } else if (approvedLeave) {
        status = "leave";
      } else {
        const hasAllocation = allocations.some(
          (allocation) =>
            allocation.date === date &&
            allocation.employee_id === employee.id,
        );

        status = hasAllocation ? "working" : "off";
      }

      entries.push({
        date,
        employee_id: employee.id,
        status,
      });
    }
  }

  return {
    entries,
    allocations,
    conflicts,
  };
}
