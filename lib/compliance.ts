import { SupabaseClient } from "@supabase/supabase-js";
import { getSchedule } from "@/lib/schedule";

export type MissedChecklistItem = {
  employeeId: string;
  employeeName: string;
  role: string;
  date: string;
  segment: string;
};

/**
 * Every checklist segment that was missed (scheduled, not on approved time
 * off, never completed) somewhere in [sinceDate, untilDate] and doesn't yet
 * have a warning issued for it. This is what "still needs attention" means
 * for compliance -- it doesn't clear on its own just because the calendar
 * moved past that day, only once a manager acts on it (issues a warning).
 *
 * untilDate should be strictly before today -- today's segments are still
 * "pending", not missed, until the day is over.
 */
export async function getOutstandingMissedChecklists(
  supabase: SupabaseClient,
  sinceDate: string,
  untilDate: string
): Promise<MissedChecklistItem[]> {
  const [{ data: employees }, { data: templates }, { shifts, timeOff }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, role")
      .eq("active", true)
      .in("role", ["front_desk", "aesthetician"]),
    supabase.from("checklist_templates").select("role, segment").eq("active", true),
    getSchedule(supabase, { startDate: sinceDate, endDate: untilDate }),
  ]);

  const segmentsByRole: Record<string, string[]> = {};
  for (const t of templates ?? []) {
    if (!segmentsByRole[t.role]) segmentsByRole[t.role] = [];
    if (!segmentsByRole[t.role].includes(t.segment)) segmentsByRole[t.role].push(t.segment);
  }

  const employeeIds = (employees ?? []).map((e) => e.id);
  if (employeeIds.length === 0) return [];

  const [{ data: submissions }, { data: warnings }] = await Promise.all([
    supabase
      .from("checklist_submissions")
      .select("employee_id, segment, completed_at, submission_date")
      .gte("submission_date", sinceDate)
      .lte("submission_date", untilDate)
      .in("employee_id", employeeIds),
    supabase
      .from("warning_notices")
      .select("employee_id, source_table, violation_date")
      .like("source_table", "checklist:%")
      .gte("violation_date", sinceDate)
      .lte("violation_date", untilDate),
  ]);

  // Which (employeeId, date) pairs actually had a shift (and weren't on
  // approved time off) -- only those could have had a checklist to do.
  const scheduledByDate = new Map<string, Set<string>>();
  for (const s of shifts) {
    if (!scheduledByDate.has(s.date)) scheduledByDate.set(s.date, new Set());
    scheduledByDate.get(s.date)!.add(s.employeeId);
  }
  const onTimeOff = (employeeId: string, date: string) =>
    timeOff.some((t) => t.employeeId === employeeId && date >= t.startDate && date <= t.endDate);

  const dates: string[] = [];
  for (let d = sinceDate; d <= untilDate; ) {
    dates.push(d);
    const next = new Date(d + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    d = next.toISOString().slice(0, 10);
  }

  const results: MissedChecklistItem[] = [];
  for (const emp of employees ?? []) {
    const segments = segmentsByRole[emp.role] ?? [];
    if (segments.length === 0) continue;
    for (const date of dates) {
      const scheduled = scheduledByDate.get(date)?.has(emp.id) ?? false;
      if (!scheduled || onTimeOff(emp.id, date)) continue;
      for (const segment of segments) {
        const sub = (submissions ?? []).find(
          (s) => s.employee_id === emp.id && s.segment === segment && s.submission_date === date
        );
        const done = Boolean(sub?.completed_at);
        if (done) continue;
        const hasWarning = (warnings ?? []).some(
          (w) => w.employee_id === emp.id && w.violation_date === date && w.source_table === `checklist:${segment}`
        );
        if (hasWarning) continue;
        results.push({ employeeId: emp.id, employeeName: emp.name, role: emp.role, date, segment });
      }
    }
  }

  results.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.employeeName.localeCompare(b.employeeName)));
  return results;
}
