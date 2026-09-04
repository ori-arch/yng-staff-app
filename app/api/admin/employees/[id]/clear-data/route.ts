import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Wipes ALL history for one employee (shifts, checklists, violations, time
 * off, shift swaps, leaderboard entries, room issue reports, restocking
 * logs, notifications, messages, etc.) while keeping the employee record
 * itself (name, role, PIN) intact -- a "start fresh" reset, not a delete.
 *
 * Destructive and irreversible, so this is owner-only and requires the
 * caller to pass the employee's exact current name as confirmText, as a
 * second confirmation beyond whatever the UI already asked.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !session.isOwner) {
    return NextResponse.json({ error: "Only the owner can clear an employee's data." }, { status: 403 });
  }

  const { confirmText } = await req.json();

  const supabase = supabaseAdmin();
  const { data: target, error: fetchError } = await supabase
    .from("employees")
    .select("id, name, is_owner")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (target.is_owner) {
    return NextResponse.json({ error: "The owner's own data can't be cleared this way." }, { status: 400 });
  }
  if (typeof confirmText !== "string" || confirmText.trim().toLowerCase() !== target.name.trim().toLowerCase()) {
    return NextResponse.json({ error: "Confirmation text didn't match the employee's name." }, { status: 400 });
  }

  const id = target.id;
  const errors: string[] = [];

  async function del(table: string, column: string) {
    const { error } = await supabase.from(table).delete().eq(column, id);
    if (error) errors.push(`${table}: ${error.message}`);
  }

  // Rows owned outright by this employee -- deleted entirely.
  await del("checklist_submissions", "employee_id"); // cascades to checklist_submission_items
  await del("shift_patterns", "employee_id");
  await del("shift_exceptions", "employee_id");
  await del("equipment_logs", "employee_id");
  await del("room_restocking_logs", "employee_id");
  await del("restock_runner_logs", "employee_id");
  await del("loft_cleaning_logs", "employee_id");
  await del("room_issue_reports", "employee_id");
  await del("warning_notices", "employee_id");
  await del("time_off_requests", "employee_id");
  await del("time_off_balance_adjustments", "employee_id");
  await del("leaderboard_entries", "employee_id");
  await del("leaderboard_adjustments", "employee_id");
  await del("policy_acknowledgments", "employee_id");
  await del("notifications", "employee_id");
  await del("push_subscriptions", "employee_id");
  await del("alert_acknowledgements", "employee_id");
  await del("channel_members", "employee_id");
  await del("bug_reports", "reported_by");

  // Shift swaps: this employee may appear as either party.
  {
    const { error } = await supabase
      .from("shift_swap_requests")
      .delete()
      .or(`requesting_employee_id.eq.${id},target_employee_id.eq.${id}`);
    if (error) errors.push(`shift_swap_requests: ${error.message}`);
  }

  // Messages this employee sent stay in their channels for everyone else --
  // just detach their name from them, same as the mock-data cleanup script.
  {
    const { error } = await supabase.from("messages").update({ sender_id: null }).eq("sender_id", id);
    if (error) errors.push(`messages: ${error.message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: `Cleared most data, but hit errors: ${errors.join("; ")}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
