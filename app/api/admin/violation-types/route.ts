import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Everyone can read the catalog (shown on /policy); managers also see inactive ones via ?all=1. */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const includeInactive = isManager(session) && new URL(req.url).searchParams.get("all") === "1";
  const supabase = supabaseAdmin();
  let query = supabase.from("violation_types").select("*").order("display_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const types = (data ?? []).map((t: any) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    track: t.track,
    levelLabel: t.level_label,
    description: t.description,
    recommendedAction: t.recommended_action,
    strikeLimit: t.strike_limit,
    resetPeriod: t.reset_period,
    displayOrder: t.display_order,
    active: t.active,
  }));

  return NextResponse.json({ violationTypes: types }, { headers: NO_STORE });
}

/** Manager-only: add a new violation type to the framework. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { key, name, track, levelLabel, description, recommendedAction, strikeLimit, resetPeriod, displayOrder } = await req.json();
  if (!key?.trim() || !name?.trim() || !["green", "yellow", "red"].includes(track) || !levelLabel?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "key, name, track, levelLabel and description are required." }, { status: 400 });
  }
  if (!["quarterly", "annually", "never"].includes(resetPeriod)) {
    return NextResponse.json({ error: "resetPeriod must be quarterly, annually, or never." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("violation_types")
    .insert({
      key: key.trim().toLowerCase().replace(/\s+/g, "_"),
      name: name.trim(),
      track,
      level_label: levelLabel.trim(),
      description: description.trim(),
      recommended_action: typeof recommendedAction === "string" ? recommendedAction.trim() || null : null,
      strike_limit: typeof strikeLimit === "number" && strikeLimit > 0 ? strikeLimit : 3,
      reset_period: resetPeriod,
      display_order: typeof displayOrder === "number" ? displayOrder : 99,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
