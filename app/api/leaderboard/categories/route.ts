import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCategories } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

function isManager(session: { role: string; isAdmin: boolean } | null): boolean {
  return !!session && (session.role === "manager" || session.isAdmin);
}

/** Everyone can read the current point values (shown on the board's "How points work" panel). */
export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const supabase = supabaseAdmin();
  const isMgr = isManager(session);
  const categories = await getCategories(supabase, !isMgr);
  return NextResponse.json({ categories }, { headers: NO_STORE });
}

/** Manager-only: add a new scoring category. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!isManager(session)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const { key, label, description, points, displayOrder } = await req.json();
  if (!key?.trim() || !label?.trim() || typeof points !== "number") {
    return NextResponse.json({ error: "key, label and points are required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("leaderboard_categories")
    .insert({
      key: key.trim().toLowerCase().replace(/\s+/g, "_"),
      label: label.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      points,
      display_order: typeof displayOrder === "number" ? displayOrder : 99,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
