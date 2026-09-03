import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getManagerRecipientIds, notifyEmployees } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Daily cron (see vercel.json). Two jobs, both about the same open cycle:
 *
 *  1. If it closes tomorrow, notify managers/the owner today so there's a
 *     day to reconcile against Zenoti (spec §6) before confirming a winner.
 *  2. If its end date has already arrived (or passed) and nobody has
 *     confirmed a winner yet, flip it to "pending_confirmation" so the
 *     board shows that instead of silently rolling over, and notify
 *     managers it's ready to review now.
 *
 * Protected by CRON_SECRET, same pattern as the missed-checklist digest.
 * Idempotent on the notification title so a Hobby-plan double-fire in one
 * day doesn't double-notify.
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
  const today = new Date().toISOString().slice(0, 10);

  const { data: cycle } = await supabase
    .from("leaderboard_cycles")
    .select("id, name, end_date, status")
    .eq("status", "open")
    .maybeSingle();

  if (!cycle) {
    return NextResponse.json({ ok: true, skipped: "no open cycle" });
  }

  const managerIds = await getManagerRecipientIds(supabase);

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  let reminded = false;
  let closed = false;

  if (cycle.end_date === tomorrowStr) {
    const title = `Leaderboard cycle "${cycle.name}" closes tomorrow`;
    const { data: existing } = await supabase.from("notifications").select("id").eq("title", title).limit(1).maybeSingle();
    if (!existing) {
      await notifyEmployees(supabase, managerIds, {
        type: "approval_needed",
        title,
        body: "Reconcile logs against Zenoti today, then confirm the winner tomorrow.",
        link: `/leaderboard/review/${cycle.id}`,
      });
      reminded = true;
    }
  }

  if (cycle.end_date <= today) {
    const { data: flipped } = await supabase
      .from("leaderboard_cycles")
      .update({ status: "pending_confirmation" })
      .eq("id", cycle.id)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (flipped) {
      closed = true;
      await notifyEmployees(supabase, managerIds, {
        type: "approval_needed",
        title: `Leaderboard cycle "${cycle.name}" is ready to confirm`,
        body: "Its end date has arrived — review the final standings and confirm a winner.",
        link: `/leaderboard/review/${cycle.id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, reminded, movedToPendingConfirmation: closed });
}
