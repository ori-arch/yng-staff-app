import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** All checklist template items (including inactive), grouped by role+segment. Admin/manager only. */
export async function GET() {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("checklist_templates")
    .select("id, role, segment, item_order, item_text, requires_photo, first_shift_only, last_shift_only, active")
    .order("role")
    .order("segment")
    .order("item_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data }, { headers: NO_STORE });
}

/** Adds a new checklist item at the end of its role+segment group. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { role, segment, itemText, requiresPhoto, firstShiftOnly, lastShiftOnly } = await req.json();

  if (!["front_desk", "aesthetician"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (!["open", "close"].includes(segment)) {
    return NextResponse.json({ error: "Invalid segment." }, { status: 400 });
  }
  if (!itemText || typeof itemText !== "string" || !itemText.trim()) {
    return NextResponse.json({ error: "Item text is required." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: existing, error: maxError } = await supabase
    .from("checklist_templates")
    .select("item_order")
    .eq("role", role)
    .eq("segment", segment)
    .order("item_order", { ascending: false })
    .limit(1);
  if (maxError) return NextResponse.json({ error: maxError.message }, { status: 500 });
  const nextOrder = (existing?.[0]?.item_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({
      role,
      segment,
      item_order: nextOrder,
      item_text: itemText.trim(),
      requires_photo: !!requiresPhoto,
      first_shift_only: !!firstShiftOnly,
      last_shift_only: !!lastShiftOnly,
    })
    .select("id, role, segment, item_order, item_text, requires_photo, first_shift_only, last_shift_only, active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
