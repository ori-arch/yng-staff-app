import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Updates one employee's role, active status, or admin flag.
 * Changing `isAdmin` (granting or revoking admin) is restricted to the owner
 * account only, per the spec's "one control point" rule — a regular admin
 * can't grant themselves or anyone else admin access.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !(session.isAdmin || session.role === "manager")) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { role, active, isAdmin, name } = await req.json();

  const supabase = supabaseAdmin();
  const { data: target, error: fetchError } = await supabase
    .from("employees")
    .select("id, is_owner")
    .eq("id", params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name can't be blank." }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (role !== undefined) {
    if (!["front_desk", "aesthetician", "manager"].includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    updates.role = role;
  }

  if (active !== undefined) {
    if (target.is_owner && active === false) {
      return NextResponse.json({ error: "The owner account can't be deactivated." }, { status: 400 });
    }
    updates.active = !!active;
  }

  if (isAdmin !== undefined) {
    if (!session.isOwner) {
      return NextResponse.json({ error: "Only the owner can grant or revoke admin access." }, { status: 403 });
    }
    if (target.is_owner) {
      return NextResponse.json({ error: "The owner is always an admin." }, { status: 400 });
    }
    updates.is_admin = !!isAdmin;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", params.id)
    .select("id, name, role, is_admin, is_owner, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}
