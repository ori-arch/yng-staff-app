import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPastDueTasks } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };
const PAGE_SIZE = 20;

/**
 * The bell icon's feed: persisted notifications (messages, broadcasts) for
 * this employee, newest first, plus (on the first page only) any past-due
 * checklist tasks computed live. `before` (an ISO timestamp) pages further
 * back through history — pass the `createdAt` of the last item you have.
 */
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");

  const supabase = supabaseAdmin();

  let query = supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("employee_id", session.employeeId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE).map((n) => ({
    id: n.id,
    type: n.type as "message" | "broadcast" | "task_due",
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read_at !== null,
    createdAt: n.created_at,
  }));

  let tasks: Awaited<ReturnType<typeof getPastDueTasks>> = [];
  if (!before) {
    tasks = await getPastDueTasks(supabase, session.employeeId, session.role);
  }

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", session.employeeId)
    .is("read_at", null);

  const notifications = [
    ...tasks.map((t) => ({ id: t.id, type: "task_due" as const, title: t.title, body: t.body, link: t.link, read: false, createdAt: t.createdAt })),
    ...page,
  ];

  return NextResponse.json(
    { notifications, hasMore, unreadCount: (unreadCount ?? 0) + tasks.length },
    { headers: NO_STORE }
  );
}
