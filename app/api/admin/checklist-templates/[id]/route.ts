import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { itemText, requiresPhoto, firstShiftOnly, lastShiftOnly, active } = await req.json();
  const updates: Record<string, unknown> = {};
  if (itemText !== undefined) {
    if (!itemText.trim()) return NextResponse.json({ error: "Item text can't be empty." }, { status: 400 });
    updates.item_text = itemText.trim();
  }
  if (requiresPhoto !== undefined) updates.requires_photo = !!requiresPhoto;
  if (firstShiftOnly !== undefined) updates.first_shift_only = !!firstShiftOnly;
  if (lastShiftOnly !== undefined) updates.last_shift_only = !!lastShiftOnly;
  if (active !== undefined) updates.active = !!active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("checklist_templates")
    .update(updates)
    .eq("id", params.id)
    .select("id, role, segment, item_order, item_text, requires_photo, first_shift_only, last_shift_only, active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
