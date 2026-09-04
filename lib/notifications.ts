import { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToEmployees } from "@/lib/push";
import { getSegmentStatus } from "@/lib/checklists";
import { getSchedule } from "@/lib/schedule";
import { todayET } from "@/lib/date";

export type NotificationType = "message" | "broadcast" | "task_due" | "approval_needed";

/**
 * Every active manager or admin (Ori, and anyone else with the manager role
 * or the admin flag) — the audience for "something needs your attention"
 * notifications: a new time-off request, a shift swap that's reached the
 * manager-approval step, a newly issued warning. Best-effort: returns an
 * empty list rather than throwing so a caller's own request never fails
 * over this lookup.
 */
export async function getManagerRecipientIds(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("employees")
      .select("id, role, is_admin")
      .eq("active", true);
    return (data ?? [])
      .filter((e: any) => e.role === "manager" || e.is_admin === true)
      .map((e: any) => e.id as string);
  } catch {
    return [];
  }
}

/**
 * Creates one notification row per recipient and best-effort pushes it to
 * their phone if they've enabled notifications. This is the single place
 * every feature should call into when something happens that a user should
 * be told about (a DM, a broadcast, and — going forward — anything else:
 * a time off decision, a shift swap request, a new warning, etc. can all
 * call this the same way).
 *
 * Never throws — a notification failing to send should never fail the
 * request that triggered it (sending a message, posting a broadcast, ...).
 */
export async function notifyEmployees(
  supabase: SupabaseClient,
  employeeIds: string[],
  notification: { type: NotificationType; title: string; body?: string; link?: string }
): Promise<void> {
  const ids = Array.from(new Set(employeeIds)).filter(Boolean);
  if (ids.length === 0) return;

  try {
    await supabase.from("notifications").insert(
      ids.map((employeeId) => ({
        employee_id: employeeId,
        type: notification.type,
        title: notification.title,
        body: notification.body ?? null,
        link: notification.link ?? null,
      }))
    );
  } catch {
    // best-effort — don't block the caller's own request over this
  }

  try {
    await sendPushToEmployees(supabase, ids, {
      title: notification.title,
      body: notification.body || "",
      url: notification.link,
    });
  } catch {
    // best-effort
  }
}

export type PastDueTask = { id: string; title: string; body: string; link: string; createdAt: string };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Current time-of-day in the shop's timezone, as minutes since midnight. */
function nowMinutesEastern(): number {
  const parts = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return toMinutes(parts);
}

/**
 * Computed on the fly (never stored) — an employee's own open/close
 * checklist segment(s) that are still outstanding today, past when they
 * should reasonably be done. Uses today's Schedule shift if one exists
 * (open: 2h after shift start; close: 30min after shift end) and falls back
 * to a shop-wide default (open by noon, close by 8pm) when no shift is on
 * file for today. These defaults are a starting assumption — Ori may want
 * to tune them once real shift data is in the system.
 */
export async function getPastDueTasks(
  supabase: SupabaseClient,
  employeeId: string,
  role: string
): Promise<PastDueTask[]> {
  if (role !== "front_desk" && role !== "aesthetician") return [];

  const segments = await getSegmentStatus(employeeId, role);
  const outstanding = segments.filter((s) => !s.completedToday);
  if (outstanding.length === 0) return [];

  const today = todayET();
  const { shifts } = await getSchedule(supabase, { startDate: today, endDate: today, employeeId });
  const myShift = shifts[0] ?? null;
  const nowMinutes = nowMinutesEastern();

  const tasks: PastDueTask[] = [];
  for (const seg of outstanding) {
    const dueMinutes =
      seg.segment === "open"
        ? myShift
          ? toMinutes(myShift.startTime) + 120
          : toMinutes("12:00")
        : myShift
          ? toMinutes(myShift.endTime) + 30
          : toMinutes("20:00");
    if (nowMinutes <= dueMinutes) continue;
    tasks.push({
      id: `task:${seg.segment}:${today}`,
      title: seg.segment === "open" ? "Opening checklist is past due" : "Closing checklist is past due",
      body: seg.startedToday ? "Started but not submitted yet." : "Not started yet today.",
      link: `/checklists/${seg.segment}`,
      createdAt: new Date().toISOString(),
    });
  }
  return tasks;
}
