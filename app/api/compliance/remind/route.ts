import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Manager-only: sends an automated nudge to an employee who hasn't
 * completed a checklist segment yet -- a soft step before a formal
 * warning. The notification's title is unique to employee/date/segment so
 * the Compliance page can show "Reminder sent" instead of re-sending it.
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { employeeId, date, segment } = await req.json();
  if (!employeeId || !date || !segment) {
    return NextResponse.json({ error: "employeeId, date, and segment are required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const title = `Checklist reminder — ${segment} (${date})`;

  try {
    await notifyEmployees(supabase, [employeeId], {
      type: "task_due",
      title,
      body: `You haven't completed your ${segment} checklist for ${fmtDate(date)} yet. Please complete it as soon as possible.`,
      link: "/checklists",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not send reminder." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
