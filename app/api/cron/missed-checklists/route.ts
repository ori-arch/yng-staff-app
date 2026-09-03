import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSchedule } from "@/lib/schedule";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Daily cron (see vercel.json) — checks *yesterday's* checklist segments for
 * every active front_desk/aesthetician employee who was actually scheduled
 * to work that day (and not on approved time off), and notifies managers/
 * the owner with a digest, plus each individual employee who missed one of
 * their own segments. Runs once a day early morning so a missed close/open
 * shows up the same day it's still fixable to talk about.
 *
 * This does NOT go to the "All Staff" broadcast — a missed checklist is
 * between the person who missed it and management, not team-wide news.
 * It also only flags people who had a real shift on the schedule that day:
 * someone who wasn't scheduled (or was on approved time off) never had a
 * checklist to complete, so they're skipped rather than flagged as missed.
 *
 * Protected by CRON_SECRET — Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when invoking a configured cron, so
 * this rejects any request that doesn't match (including manual hits).
 * Idempotent: skips notifying again if a report for the same date was
 * already sent, in case the Hobby-plan cron fires more than once in a day.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }
  }

  const supabase = supabaseAdmin();

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = yesterday.toISOString().slice(0, 10);

  const reportTitle = `Missed Checklist Report — ${date}`;
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("title", reportTitle)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, skipped: "already reported for this date" });
  }

  const [{ data: employees, error: empError }, { data: templates, error: tplError }, { shifts, timeOff }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, role")
      .eq("active", true)
      .in("role", ["front_desk", "aesthetician"])
      .order("name"),
    supabase.from("checklist_templates").select("role, segment").eq("active", true),
    getSchedule(supabase, { startDate: date, endDate: date }),
  ]);
  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 });
  if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 });

  // Only employees who actually had a shift that day, and weren't on
  // approved time off, could have had a checklist to complete.
  const scheduledIds = new Set(shifts.map((s) => s.employeeId));
  const onApprovedTimeOffIds = new Set(
    timeOff.filter((t) => date >= t.startDate && date <= t.endDate).map((t) => t.employeeId)
  );
  const scheduledEmployees = (employees ?? []).filter(
    (emp) => scheduledIds.has(emp.id) && !onApprovedTimeOffIds.has(emp.id)
  );

  const segmentsByRole: Record<string, string[]> = {};
  for (const t of templates ?? []) {
    if (!segmentsByRole[t.role]) segmentsByRole[t.role] = [];
    if (!segmentsByRole[t.role].includes(t.segment)) segmentsByRole[t.role].push(t.segment);
  }

  const employeeIds = scheduledEmployees.map((e) => e.id);
  const { data: submissions, error: subError } = await supabase
    .from("checklist_submissions")
    .select("employee_id, segment, completed_at")
    .eq("submission_date", date)
    .in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

  const missed: { employeeId: string; name: string; segments: string[] }[] = [];
  for (const emp of scheduledEmployees) {
    const segments = segmentsByRole[emp.role] ?? [];
    const missedSegments = segments.filter((segment) => {
      const sub = (submissions ?? []).find((s) => s.employee_id === emp.id && s.segment === segment);
      return !sub?.completed_at;
    });
    if (missedSegments.length > 0) {
      missed.push({ employeeId: emp.id, name: emp.name, segments: missedSegments });
    }
  }

  if (missed.length === 0) {
    return NextResponse.json({ ok: true, missed: 0 });
  }

  const digestBody = missed.map((m) => `${m.name}: ${m.segments.join(", ")}`).join("\n");
  const managerIds = await getManagerRecipientIds(supabase);
  await notifyEmployees(supabase, managerIds, {
    type: "task_due",
    title: reportTitle,
    body: digestBody,
    link: "/compliance",
  });

  // Also let each person who missed one know directly -- just them, not
  // the whole team.
  await Promise.all(
    missed.map((m) =>
      notifyEmployees(supabase, [m.employeeId], {
        type: "task_due",
        title: "You missed a checklist yesterday",
        body: `${m.segments.join(", ")} — talk to a manager if something got in the way.`,
        link: "/checklists",
      })
    )
  );

  return NextResponse.json({ ok: true, missed: missed.length });
}
