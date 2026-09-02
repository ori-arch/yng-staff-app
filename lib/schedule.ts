import { SupabaseClient } from "@supabase/supabase-js";

export type ShiftInstance = {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "09:00"
  endTime: string;
  source: "pattern" | "exception";
  note: string | null;
  roomId: string | null;
  roomName: string | null;
};

export type TimeOffBlock = {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDate(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let cur = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  while (cur <= end) {
    out.push(fmtDate(cur));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

function hhmm(t: string | null): string {
  // Postgres `time` comes back as "09:00:00" — trim to "09:00".
  return t ? t.slice(0, 5) : "";
}

/**
 * Combines recurring shift_patterns with one-off shift_exceptions into the
 * actual list of who's working when, for a date range. Optionally scoped to
 * one employee (staff viewing their own schedule); omit employeeId to get
 * everyone (manager/admin team view).
 *
 * Also returns approved time off overlapping the range, so callers (the
 * schedule calendar, "My Shifts") can show it alongside shifts without a
 * second round trip — Ori asked for the schedule to surface "additional
 * stuff from our various features that's worth displaying" alongside shifts.
 */
export async function getSchedule(
  supabase: SupabaseClient,
  opts: { startDate: string; endDate: string; employeeId?: string }
): Promise<{ shifts: ShiftInstance[]; timeOff: TimeOffBlock[] }> {
  const { startDate, endDate, employeeId } = opts;

  let patternsQuery = supabase
    .from("shift_patterns")
    .select("id, employee_id, weekday, start_time, end_time, note, room_id, employees!shift_patterns_employee_id_fkey(name), rooms(name)")
    .eq("active", true);
  if (employeeId) patternsQuery = patternsQuery.eq("employee_id", employeeId);
  const { data: patterns, error: patternsError } = await patternsQuery;
  if (patternsError) throw patternsError;

  let exceptionsQuery = supabase
    .from("shift_exceptions")
    .select("id, employee_id, date, action, start_time, end_time, note, room_id, employees!shift_exceptions_employee_id_fkey(name), rooms(name)")
    .eq("active", true)
    .gte("date", startDate)
    .lte("date", endDate);
  if (employeeId) exceptionsQuery = exceptionsQuery.eq("employee_id", employeeId);
  const { data: exceptions, error: exceptionsError } = await exceptionsQuery;
  if (exceptionsError) throw exceptionsError;

  let timeOffQuery = supabase
    .from("time_off_requests")
    .select("employee_id, start_date, end_date, reason, employees!time_off_requests_employee_id_fkey(name)")
    .eq("status", "approved")
    .lte("start_date", endDate)
    .gte("end_date", startDate);
  if (employeeId) timeOffQuery = timeOffQuery.eq("employee_id", employeeId);
  const { data: timeOffRows, error: timeOffError } = await timeOffQuery;
  if (timeOffError) throw timeOffError;

  const nameOf = (row: { employees: unknown }): string => {
    const e = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    return (e as { name?: string } | null)?.name ?? "Unknown";
  };
  const roomNameOf = (row: { rooms: unknown }): string | null => {
    const r = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;
    return (r as { name?: string } | null)?.name ?? null;
  };

  const dates = eachDate(startDate, endDate);
  const byEmployeeDate = new Map<string, ShiftInstance[]>();
  const key = (empId: string, date: string) => `${empId}|${date}`;

  for (const date of dates) {
    const weekday = toUtcDate(date).getUTCDay();
    for (const p of patterns ?? []) {
      if (p.weekday !== weekday) continue;
      const k = key(p.employee_id, date);
      const arr = byEmployeeDate.get(k) ?? [];
      arr.push({
        employeeId: p.employee_id,
        employeeName: nameOf(p),
        date,
        startTime: hhmm(p.start_time),
        endTime: hhmm(p.end_time),
        source: "pattern",
        note: p.note ?? null,
        roomId: p.room_id ?? null,
        roomName: roomNameOf(p),
      });
      byEmployeeDate.set(k, arr);
    }
  }

  for (const ex of exceptions ?? []) {
    const k = key(ex.employee_id, ex.date);
    if (ex.action === "skip") {
      byEmployeeDate.delete(k);
      continue;
    }
    // 'add' or 'modify' — replace whatever's there for that employee/date
    // with the exception's times (modify assumes one shift/day, which
    // covers the common case; a second 'add' can still layer another).
    const entry: ShiftInstance = {
      employeeId: ex.employee_id,
      employeeName: nameOf(ex),
      date: ex.date,
      startTime: hhmm(ex.start_time),
      endTime: hhmm(ex.end_time),
      source: "exception",
      note: ex.note ?? null,
      roomId: ex.room_id ?? null,
      roomName: roomNameOf(ex),
    };
    if (ex.action === "modify") {
      byEmployeeDate.set(k, [entry]);
    } else {
      const arr = byEmployeeDate.get(k) ?? [];
      arr.push(entry);
      byEmployeeDate.set(k, arr);
    }
  }

  const shifts = Array.from(byEmployeeDate.values())
    .flat()
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.employeeName.localeCompare(b.employeeName));

  const timeOff: TimeOffBlock[] = (timeOffRows ?? []).map((r) => ({
    employeeId: r.employee_id,
    employeeName: nameOf(r),
    startDate: r.start_date,
    endDate: r.end_date,
    reason: r.reason,
  }));

  return { shifts, timeOff };
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
