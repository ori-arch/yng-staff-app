import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Public-ish roster for the login picker: names + ids only, no PIN data. */
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, role")
    .eq("active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ employees: data });
}
