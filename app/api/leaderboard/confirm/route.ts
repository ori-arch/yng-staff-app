import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { notifyEmployees } from "@/lib/notifications";
import { computeStandings } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/**
 * The one deliberately manual step in the whole module (spec §4.2): a
 * manager reviews the final standings and explicitly confirms a winner --
 * defaulting to the point leader, but overridable with a required reason --
 * then this posts the announcement to the "All Staff" broadcast channel and
 * closes the cycle for good. Nothing about this fires on its own.
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { cycleId, winnerEmployeeId, overrideReason, announcementText } = await req.json();
  if (!cycleId || !winnerEmployeeId || !announcementText?.trim()) {
    return NextResponse.json({ error: "cycleId, winnerEmployeeId and announcementText are required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: cycle } = await supabase
    .from("leaderboard_cycles")
    .select("id, status")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle) return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
  if (cycle.status === "closed") return NextResponse.json({ error: "This cycle is already closed." }, { status: 400 });

  const standings = await computeStandings(supabase, cycleId);
  const leader = standings[0];
  if (leader && winnerEmployeeId !== leader.employeeId && !overrideReason?.trim()) {
    return NextResponse.json(
      { error: `${leader.employeeName} is the point leader — overriding requires a reason.` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("leaderboard_cycles")
    .update({
      status: "closed",
      winner_employee_id: winnerEmployeeId,
      winner_override_reason: overrideReason?.trim() || null,
      confirmed_by: session!.employeeId,
      confirmed_at: now,
      announced_at: now,
    })
    .eq("id", cycleId)
    .neq("status", "closed")
    .select("id")
    .single();
  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Could not close the cycle." }, { status: 500 });
  }

  // Post the announcement, same broadcast mechanism as /broadcast.
  const { data: channel } = await supabase.from("channels").select("id").eq("type", "broadcast").limit(1).maybeSingle();
  if (channel) {
    const { data: message } = await supabase
      .from("messages")
      .insert({ channel_id: channel.id, sender_id: session!.employeeId, body: announcementText.trim() })
      .select("id")
      .single();

    const { data: recipients } = await supabase.from("employees").select("id").eq("active", true);
    const preview = announcementText.trim().length > 120 ? `${announcementText.trim().slice(0, 117)}...` : announcementText.trim();
    await notifyEmployees(supabase, (recipients ?? []).map((e) => e.id), {
      type: "broadcast",
      title: `Broadcast from ${session!.name}`,
      body: preview,
      link: message ? `/messages/${channel.id}` : "/leaderboard",
    });
  }

  return NextResponse.json({ ok: true });
}
