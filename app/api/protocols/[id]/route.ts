import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Returns one protocol plus the version history for its title (old archived versions). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: protocol, error } = await supabase
    .from("protocols")
    .select("id, title, category, file_url, body_text, version, archived, created_at, employees(name)")
    .eq("id", params.id)
    .single();

  if (error || !protocol) {
    return NextResponse.json({ error: "Protocol not found." }, { status: 404 });
  }

  const { data: history } = await supabase
    .from("protocols")
    .select("id, version, archived, created_at, employees(name)")
    .eq("title", protocol.title)
    .order("version", { ascending: false });

  const uploader = Array.isArray(protocol.employees) ? protocol.employees[0] : protocol.employees;

  return NextResponse.json(
    {
      protocol: {
        id: protocol.id,
        title: protocol.title,
        category: protocol.category,
        fileUrl: protocol.file_url,
        bodyText: protocol.body_text,
        version: protocol.version,
        archived: protocol.archived,
        createdAt: protocol.created_at,
        uploadedByName: uploader?.name ?? null,
      },
      history: (history ?? []).map((h) => {
        const emp = Array.isArray(h.employees) ? h.employees[0] : h.employees;
        return {
          id: h.id,
          version: h.version,
          archived: h.archived,
          createdAt: h.created_at,
          uploadedByName: emp?.name ?? null,
        };
      }),
    },
    { headers: NO_STORE }
  );
}
