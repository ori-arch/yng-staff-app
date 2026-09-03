import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Manager-only: edit any field of a violation type, or deactivate/reactivate it.
 * Existing warnings keep the track/description they were issued under (snapshotted) --
 * editing here only changes what applies going forward. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { name, track, levelLabel, description, recommendedAction, strikeLimit, resetPeriod, displayOrder, active } = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof track === "string" && ["green", "yellow", "red"].includes(track)) updates.track = track;
  if (typeof levelLabel === "string" && levelLabel.trim()) updates.level_label = levelLabel.trim();
  if (typeof description === "string" && description.trim()) updates.description = description.trim();
  if (typeof recommendedAction === "string") updates.recommended_action = recommendedAction.trim() || null;
  if (typeof strikeLimit === "number" && strikeLimit > 0) updates.strike_limit = strikeLimit;
  if (typeof resetPeriod === "string" && ["quarterly", "annually", "never"].includes(resetPeriod)) updates.reset_period = resetPeriod;
  if (typeof displayOrder === "number") updates.display_order = displayOrder;
  if (typeof active === "boolean") updates.active = active;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("violation_types").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
