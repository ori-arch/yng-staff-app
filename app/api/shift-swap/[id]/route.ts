import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Two-step approval, one endpoint: the target coworker accepts/declines
 * (picking which of the offered shifts she'll actually cover) while status
 * is "pending_coworker"; a manager/admin approves/denies the shifts the
 * coworker agreed to while status is "pending_owner".
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;

  const { action, acceptedShiftIds } = await req.json();
  if (action !== "accept" && action !== "decline" && action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: swap, error: fetchError } = await supabase
    .from("shift_swap_requests")
    .select("id, requesting_employee_id, target_employee_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!swap) return NextResponse.json({ error: "Swap request not found." }, { status: 404 });

  const { data: shiftRows, error: shiftsFetchError } = await supabase
    .from("shift_swap_request_shifts")
    .select("id, shift_date, start_time, end_time, room_id, accepted, owner_approved")
    .eq("swap_request_id", params.id);
  if (shiftsFetchError) return NextResponse.json({ error: shiftsFetchError.message }, { status: 500 });

  if (swap.status === "pending_coworker") {
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "This request needs the coworker's response first." }, { status: 400 });
    }
    if (session.employeeId !== swap.target_employee_id) {
      return NextResponse.json({ error: "Only the requested coworker can respond to this." }, { status: 403 });
    }

    const acceptedIds = new Set(Array.isArray(acceptedShiftIds) ? acceptedShiftIds : []);
    const anyAccepted = action === "accept" && (shiftRows ?? []).some((s) => acceptedIds.has(s.id));
    const newStatus = anyAccepted ? "pending_owner" : "denied";

    for (const s of shiftRows ?? []) {
      await supabase
        .from("shift_swap_request_shifts")
        .update({ accepted: action === "accept" && acceptedIds.has(s.id) })
        .eq("id", s.id);
    }

    const { data: updated, error } = await supabase
      .from("shift_swap_requests")
      .update({ status: newStatus, coworker_responded_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("status", "pending_coworker")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "This request has already been responded to." }, { status: 400 });
    }

    if (anyAccepted) {
      const managerIds = await getManagerRecipientIds(supabase);
      const { data: names } = await supabase
        .from("employees")
        .select("id, name")
        .in("id", [swap.requesting_employee_id, swap.target_employee_id]);
      const nameOf = (id: string) => names?.find((n) => n.id === id)?.name ?? "Someone";
      const count = (shiftRows ?? []).filter((s) => acceptedIds.has(s.id)).length;
      await notifyEmployees(supabase, managerIds, {
        type: "approval_needed",
        title: "Shift swap needs approval",
        body: `${nameOf(swap.requesting_employee_id)} ↔ ${nameOf(swap.target_employee_id)}: ${count} shift${count === 1 ? "" : "s"} agreed`,
        link: "/shift-swap",
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (swap.status === "pending_owner") {
    if (action !== "approve" && action !== "deny") {
      return NextResponse.json({ error: "This request is awaiting the coworker's response." }, { status: 400 });
    }
    if (!isManager) {
      return NextResponse.json({ error: "Managers only." }, { status: 403 });
    }

    const acceptedShifts = (shiftRows ?? []).filter((s) => s.accepted && !s.owner_approved);

    const { data: updated, error } = await supabase
      .from("shift_swap_requests")
      .update({
        status: action === "approve" ? "approved" : "denied",
        owner_decided_at: new Date().toISOString(),
        decided_by: session.employeeId,
      })
      .eq("id", params.id)
      .eq("status", "pending_owner")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "This request has already been decided." }, { status: 400 });
    }

    if (action === "approve" && acceptedShifts.length > 0) {
      const exceptions = acceptedShifts.flatMap((s) => [
        {
          employee_id: swap.requesting_employee_id,
          date: s.shift_date,
          action: "skip",
          created_by: session.employeeId,
          note: "Shift swap approved",
        },
        {
          employee_id: swap.target_employee_id,
          date: s.shift_date,
          action: "add",
          start_time: s.start_time,
          end_time: s.end_time,
          room_id: s.room_id,
          created_by: session.employeeId,
          note: "Covering a shift swap",
        },
      ]);
      const { error: scheduleError } = await supabase.from("shift_exceptions").insert(exceptions);
      if (scheduleError) {
        return NextResponse.json({
          ok: true,
          warning: "Swap approved, but the schedule couldn't be updated automatically: " + scheduleError.message,
        });
      }
      await supabase
        .from("shift_swap_request_shifts")
        .update({ owner_approved: true })
        .in("id", acceptedShifts.map((s) => s.id));
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "This request has already been decided." }, { status: 400 });
}
