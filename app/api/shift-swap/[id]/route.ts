import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Two-step approval, one endpoint: the target coworker accepts/declines
 * while status is "pending_coworker"; a manager/admin approves/denies while
 * status is "pending_owner". Which branch runs is decided by the caller's
 * session + the row's current status, same pattern as /api/warnings/[id].
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const isManager = session.role === "manager" || session.isAdmin;

  const { action } = await req.json();
  if (action !== "accept" && action !== "decline" && action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: swap, error: fetchError } = await supabase
    .from("shift_swap_requests")
    .select("id, requesting_employee_id, target_employee_id, shift_description, status")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!swap) return NextResponse.json({ error: "Swap request not found." }, { status: 404 });

  if (swap.status === "pending_coworker") {
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "This request needs the coworker's response first." }, { status: 400 });
    }
    if (session.employeeId !== swap.target_employee_id) {
      return NextResponse.json({ error: "Only the requested coworker can respond to this." }, { status: 403 });
    }
    const { data: updated, error } = await supabase
      .from("shift_swap_requests")
      .update({
        status: action === "accept" ? "pending_owner" : "denied",
        coworker_responded_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("status", "pending_coworker")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "This request has already been responded to." }, { status: 400 });
    }

    if (action === "accept") {
      const managerIds = await getManagerRecipientIds(supabase);
      const { data: names } = await supabase
        .from("employees")
        .select("id, name")
        .in("id", [swap.requesting_employee_id, swap.target_employee_id]);
      const nameOf = (id: string) => names?.find((n) => n.id === id)?.name ?? "Someone";
      await notifyEmployees(supabase, managerIds, {
        type: "approval_needed",
        title: "Shift swap needs approval",
        body: `${nameOf(swap.requesting_employee_id)} ↔ ${nameOf(swap.target_employee_id)}: ${swap.shift_description}`,
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
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "This request has already been decided." }, { status: 400 });
}
