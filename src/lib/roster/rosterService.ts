import { supabase } from "../supabase";
import {
  generateRoster,
  type GenerateRosterInput,
  type GenerationResult,
} from "./engine";

function getMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Invalid month. Expected YYYY-MM.");
  }

  const [year, monthNumber] = month.split("-").map(Number);

  const lastDay = new Date(
    Date.UTC(year, monthNumber, 0)
  ).getUTCDate();

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function loadRosterInput(
  month: string
): Promise<GenerateRosterInput> {
  const { startDate, endDate } = getMonthRange(month);

  const [
    employeesResult,
    processesResult,
    assignmentsResult,
    rulesResult,
    holidaysResult,
    leavesResult,
    exceptionsResult,
  ] = await Promise.all([
    supabase.from("employees").select(
      "id, employee_code, full_name, weekly_off_days, max_daily_assignments, is_active"
    ),

    supabase.from("brand_processes").select(
      "id, brand_id, process_id, operating_days, min_staff, exclude_public_holidays, shift_start, shift_end, is_active, brands(name), processes(name)"
    ),

    supabase.from("assignments").select(
      "employee_id, brand_process_id"
    ),

    supabase.from("process_day_rules").select(
      "brand_process_id, weekday, is_operating_day, min_staff"
    ),

    supabase
      .from("holidays")
      .select("holiday_date")
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate),

    supabase
      .from("leaves")
      .select(
        "employee_id, start_date, end_date, leave_type, status"
      )
      .lte("start_date", endDate)
      .gte("end_date", startDate),

    supabase
      .from("employee_availability")
      .select(
        "employee_id, availability_date, is_available"
      )
      .gte("availability_date", startDate)
      .lte("availability_date", endDate),
  ]);

  const results = [
    employeesResult,
    processesResult,
    assignmentsResult,
    rulesResult,
    holidaysResult,
    leavesResult,
    exceptionsResult,
  ];

  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw new Error(failed.error.message);
  }
  if (!employeesResult.data?.length) {
    throw new Error(
      "No employees found. Add employees before generating a roster."
    );
  }
  
  if (!processesResult.data?.some((process) => process.is_active)) {
    throw new Error(
      "No active brand processes found. Configure at least one process."
    );
  }

  return {
      startDate,
      endDate,
      employees: employeesResult.data ?? [],
      brandProcesses: processesResult.data ?? [],
      assignments: assignmentsResult.data ?? [],
      processDayRules: rulesResult.data ?? [],
      holidays: holidaysResult.data ?? [],
      leaves: leavesResult.data ?? [],
      availabilityExceptions: exceptionsResult.data ?? [],
  } as unknown as GenerateRosterInput;
}

export async function previewRoster(
  month: string
): Promise<GenerationResult> {
  const input = await loadRosterInput(month);
  return generateRoster(input);
}

export async function saveRosterDraft(
  month: string,
  result: GenerationResult
): Promise<string> {
  const { startDate } = getMonthRange(month);

  const { data: existing, error: lookupError } = await supabase
    .from("rosters")
    .select("id, status")
    .eq("month_start", startDate)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  if (existing?.status === "published") {
    throw new Error(
      "This month's roster is already published and cannot be overwritten."
    );
  }

  let rosterId: string;

  if (existing) {
    rosterId = existing.id;

    // Clear old draft allocations first, then their parent entries.
    const { data: oldEntries, error: entriesError } =
      await supabase
        .from("roster_entries")
        .select("id")
        .eq("roster_id", rosterId);

    if (entriesError) throw new Error(entriesError.message);

    const oldEntryIds = (oldEntries ?? []).map((entry) => entry.id);

    const batchSize = 100;

for (let i = 0; i < oldEntryIds.length; i += batchSize) {
  const batch = oldEntryIds.slice(i, i + batchSize);

  const { error: allocationError } = await supabase
    .from("roster_allocations")
    .delete()
    .in("roster_entry_id", batch);

  if (allocationError) {
    throw new Error(allocationError.message);
  }
}

    const { error: deleteEntriesError } = await supabase
      .from("roster_entries")
      .delete()
      .eq("roster_id", rosterId);

    if (deleteEntriesError) {
      throw new Error(deleteEntriesError.message);
    }

    const { error: deleteConflictsError } = await supabase
      .from("roster_conflicts")
      .delete()
      .eq("roster_id", rosterId);

    if (deleteConflictsError) {
      throw new Error(deleteConflictsError.message);
    }

    const { error: updateError } = await supabase
      .from("rosters")
      .update({ status: "draft", published_at: null })
      .eq("id", rosterId);

    if (updateError) throw new Error(updateError.message);
  } else {
    const { data: created, error: createError } = await supabase
      .from("rosters")
      .insert({
        month_start: startDate,
        status: "draft",
      })
      .select("id")
      .single();

    if (createError || !created) {
      throw new Error(
        createError?.message ?? "Could not create roster."
      );
    }

    rosterId = created.id;
  }

  // Insert in batches to avoid oversized requests.
  const entryIdMap = new Map<string, string>();
  const batchSize = 200;

  for (let i = 0; i < result.entries.length; i += batchSize) {
    const batch = result.entries.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from("roster_entries")
      .insert(
        batch.map((entry) => ({
          roster_id: rosterId,
          employee_id: entry.employee_id,
          roster_date: entry.date,
          status: entry.status,
        }))
      )
      .select("id, employee_id, roster_date");

    if (error) throw new Error(error.message);

    for (const entry of data ?? []) {
      entryIdMap.set(
        `${entry.employee_id}|${entry.roster_date}`,
        entry.id
      );
    }
  }

  const allocationRows = result.allocations.map((allocation) => {
    const entryId = entryIdMap.get(
      `${allocation.employee_id}|${allocation.date}`
    );

    if (!entryId) {
      throw new Error("Missing roster entry for allocation.");
    }

    return {
      roster_entry_id: entryId,
      brand_process_id: allocation.brand_process_id,
      shift_start: allocation.shift_start,
      shift_end: allocation.shift_end,
    };
  });

  for (let i = 0; i < allocationRows.length; i += batchSize) {
    const { error } = await supabase
      .from("roster_allocations")
      .insert(allocationRows.slice(i, i + batchSize));

    if (error) throw new Error(error.message);
  }

  const conflictRows = result.conflicts.map((conflict) => ({
    roster_id: rosterId,
    conflict_type: conflict.conflict_type,
    severity: conflict.severity,
    conflict_date: conflict.date,
    brand_process_id: conflict.brand_process_id,
    message: conflict.message,
    resolution_status: "open",
  }));

  for (let i = 0; i < conflictRows.length; i += batchSize) {
    const { error } = await supabase
      .from("roster_conflicts")
      .insert(conflictRows.slice(i, i + batchSize));

    if (error) throw new Error(error.message);
  }

  return rosterId;
}

export async function revalidateRoster(month: string) {
    const result = await previewRoster(month);
  
    const { data: roster, error } = await supabase
      .from("rosters")
      .select("id, status")
      .eq("month_start", `${month}-01`)
      .maybeSingle();
  
    if (error) {
      throw new Error(`Could not find roster: ${error.message}`);
    }
  
    if (!roster) {
      throw new Error("No saved draft exists for this month. Generate and save a roster first.");
    }
  
    if (roster.status === "published") {
      throw new Error("This roster is already published and cannot be revalidated as a draft.");
    }
  
    await saveRosterDraft(month, result);
  
    return result;
  }
  
  export async function publishRoster(month: string) {
    const { data: existingRoster, error: lookupError } = await supabase
      .from("rosters")
      .select("id, status")
      .eq("month_start", `${month}-01`)
      .maybeSingle();
  
    if (lookupError) {
      throw new Error(lookupError.message);
    }
  
    if (!existingRoster) {
      throw new Error("Generate and save a roster draft before publishing.");
    }
  
    if (existingRoster.status === "published") {
      throw new Error("This roster has already been published.");
    }
  
    // Always validate against the latest employee and process data.
    const freshResult = await previewRoster(month);
  
    const hardConflicts = freshResult.conflicts.filter(
      (conflict) => conflict.severity === "hard",
    );
  
    if (hardConflicts.length > 0) {
      throw new Error(
        `Publishing blocked: ${hardConflicts.length} hard conflict(s) remain. Review the Conflicts page and fix the underlying issues.`,
      );
    }
  
    // Replace the old draft with the freshly validated result.
    await saveRosterDraft(month, freshResult);
  
    const { error: publishError } = await supabase
      .from("rosters")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", existingRoster.id)
      .eq("status", "draft");
  
    if (publishError) {
      throw new Error(`Could not publish roster: ${publishError.message}`);
    }
  
    return freshResult;
  }