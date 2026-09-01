import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

/** Lists the broadcast channel plus every DM channel the current employee belongs to. */
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  const { data: memberRows, error: memberError } = await supabase
    .from("channel_members")
    .select("channel_id")
    .eq("employee_id", session.employeeId);
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  const memberChannelIds = (memberRows ?? []).map((r) => r.channel_id);

  const { data: broadcastChannels, error: bcError } = await supabase
    .from("channels")
    .select("id, type, name, created_at")
    .eq("type", "broadcast");
  if (bcError) {
    return NextResponse.json({ error: bcError.message }, { status: 500 });
  }

  const dmIds = memberChannelIds.filter((id) => !(broadcastChannels ?? []).some((b) => b.id === id));
  let dmChannels: { id: string; type: string; name: string | null; created_at: string }[] = [];
  if (dmIds.length > 0) {
    const { data, error } = await supabase
      .from("channels")
      .select("id, type, name, created_at")
      .in("id", dmIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    dmChannels = data ?? [];
  }

  const allChannels = [...(broadcastChannels ?? []), ...dmChannels];

  const results = [];
  for (const ch of allChannels) {
    let title = ch.name ?? "Broadcast";
    if (ch.type === "dm") {
      const { data: members } = await supabase
        .from("channel_members")
        .select("employees(name)")
        .eq("channel_id", ch.id)
        .neq("employee_id", session.employeeId);
      const other = members?.[0];
      const otherEmp = Array.isArray(other?.employees) ? other?.employees[0] : other?.employees;
      title = otherEmp?.name ?? "Direct Message";
    }
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("body, created_at, sender_id, employees(name)")
      .eq("channel_id", ch.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sender = Array.isArray(lastMsg?.employees) ? lastMsg?.employees[0] : lastMsg?.employees;

    results.push({
      id: ch.id,
      type: ch.type,
      title,
      lastMessage: lastMsg
        ? { body: lastMsg.body, createdAt: lastMsg.created_at, senderName: sender?.name ?? null }
        : null,
    });
  }

  results.sort((a, b) => {
    if (a.type === "broadcast") return -1;
    if (b.type === "broadcast") return 1;
    const at = a.lastMessage?.createdAt ?? "";
    const bt = b.lastMessage?.createdAt ?? "";
    return bt.localeCompare(at);
  });

  return NextResponse.json({ channels: results }, { headers: NO_STORE });
}

/** Starts (or reuses) a DM channel with another employee. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { otherEmployeeId } = await req.json();
  if (typeof otherEmployeeId !== "string" || !otherEmployeeId) {
    return NextResponse.json({ error: "Missing otherEmployeeId." }, { status: 400 });
  }
  if (otherEmployeeId === session.employeeId) {
    return NextResponse.json({ error: "Can't message yourself." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Look for an existing DM channel containing exactly these two members.
  const { data: myChannels } = await supabase
    .from("channel_members")
    .select("channel_id, channels!inner(type)")
    .eq("employee_id", session.employeeId)
    .eq("channels.type", "dm");

  for (const row of myChannels ?? []) {
    const { data: members } = await supabase
      .from("channel_members")
      .select("employee_id")
      .eq("channel_id", row.channel_id);
    const ids = (members ?? []).map((m) => m.employee_id).sort();
    const target = [session.employeeId, otherEmployeeId].sort();
    if (ids.length === 2 && ids[0] === target[0] && ids[1] === target[1]) {
      return NextResponse.json({ id: row.channel_id });
    }
  }

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .insert({ type: "dm" })
    .select("id")
    .single();
  if (channelError) {
    return NextResponse.json({ error: channelError.message }, { status: 500 });
  }

  const { error: memberError } = await supabase.from("channel_members").insert([
    { channel_id: channel.id, employee_id: session.employeeId },
    { channel_id: channel.id, employee_id: otherEmployeeId },
  ]);
  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ id: channel.id });
}
