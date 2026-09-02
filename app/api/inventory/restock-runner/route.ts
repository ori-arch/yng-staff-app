import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { RESTOCK_RUNNER_STEPS } from "@/lib/inventory-steps";
import { postBroadcastAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Lists recent Restock Runner duty logs. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("restock_runner_logs")
    .select("id, log_date, checklist_json, low_inventory_items, created_at, employees(name)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs = (data ?? []).map((l) => {
    const emp = Array.isArray(l.employees) ? l.employees[0] : l.employees;
    return {
      id: l.id,
      logDate: l.log_date,
      createdAt: l.created_at,
      checklist: l.checklist_json,
      lowInventoryItems: l.low_inventory_items ?? [],
      employeeName: emp?.name ?? null,
    };
  });

  return NextResponse.json({ logs, steps: RESTOCK_RUNNER_STEPS }, { headers: NO_STORE });
}

/** Records one completed Restock Runner duty. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json();
  const { checklist, lowInventoryItems } = body ?? {};

  if (!checklist || typeof checklist !== "object") {
    return NextResponse.json({ error: "Missing checklist." }, { status: 400 });
  }
  const missing = RESTOCK_RUNNER_STEPS.filter((step) => !checklist[step]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.length} step(s) still need to be checked off.` },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("restock_runner_logs").insert({
    employee_id: session.employeeId,
    checklist_json: checklist,
    low_inventory_items: Array.isArray(lowInventoryItems) ? lowInventoryItems : [],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const flagged = Array.isArray(lowInventoryItems) ? lowInventoryItems.filter((s) => typeof s === "string" && s.trim()) : [];
  if (flagged.length > 0) {
    try {
      await postBroadcastAlert(
        supabase,
        `⚠️ Restock Runner (${session.name}) flagged low inventory: ${flagged.join(", ")}.`
      );
    } catch {
      // Best-effort — don't fail the submission over an alert post.
    }
  }

  return NextResponse.json({ ok: true });
}
