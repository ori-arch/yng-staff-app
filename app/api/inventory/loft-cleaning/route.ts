import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LOFT_CLEANING_STEPS } from "@/lib/inventory-steps";
import { postBroadcastAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Lists recent Loft Cleaning duty logs. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("loft_cleaning_logs")
    .select(
      "id, log_date, low_on_clean_linens, last_shift_loft_duty, fridge_items_over_week_old, fridge_items_unlabeled, remarks, created_at, employees(name)"
    )
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
      lowOnCleanLinens: l.low_on_clean_linens,
      lastShiftLoftDuty: l.last_shift_loft_duty,
      fridgeItemsOverWeekOld: l.fridge_items_over_week_old,
      fridgeItemsUnlabeled: l.fridge_items_unlabeled,
      remarks: l.remarks,
      employeeName: emp?.name ?? null,
    };
  });

  return NextResponse.json({ logs, steps: LOFT_CLEANING_STEPS }, { headers: NO_STORE });
}

/** Records one completed Loft Cleaning duty. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await req.json();
  const {
    checklist,
    lowOnCleanLinens,
    lastShiftLoftDuty,
    fridgeItemsOverWeekOld,
    fridgeItemsUnlabeled,
    remarks,
  } = body ?? {};

  if (!checklist || typeof checklist !== "object") {
    return NextResponse.json({ error: "Missing checklist." }, { status: 400 });
  }
  const missing = LOFT_CLEANING_STEPS.filter((step) => !checklist[step]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.length} step(s) still need to be checked off.` },
      { status: 400 }
    );
  }
  for (const [label, val] of [
    ["low on clean linens", lowOnCleanLinens],
    ["last-shift loft duty", lastShiftLoftDuty],
    ["fridge items over a week old", fridgeItemsOverWeekOld],
    ["unlabeled fridge items", fridgeItemsUnlabeled],
  ] as const) {
    if (typeof val !== "boolean") {
      return NextResponse.json({ error: `Please answer: ${label}?` }, { status: 400 });
    }
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("loft_cleaning_logs").insert({
    employee_id: session.employeeId,
    checklist_json: checklist,
    low_on_clean_linens: lowOnCleanLinens,
    last_shift_loft_duty: lastShiftLoftDuty,
    fridge_items_over_week_old: fridgeItemsOverWeekOld,
    fridge_items_unlabeled: fridgeItemsUnlabeled,
    remarks: typeof remarks === "string" && remarks.trim() ? remarks.trim() : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const flags: string[] = [];
  if (lowOnCleanLinens) flags.push("low on clean linens");
  if (fridgeItemsOverWeekOld) flags.push("items in the fridge over a week old");
  if (fridgeItemsUnlabeled) flags.push("unlabeled fridge items");
  if (flags.length > 0) {
    try {
      await postBroadcastAlert(supabase, `⚠️ Loft Cleaning (${session.name}) flagged: ${flags.join("; ")}.`);
    } catch {
      // Best-effort — don't fail the submission over an alert post.
    }
  }

  return NextResponse.json({ ok: true });
}
