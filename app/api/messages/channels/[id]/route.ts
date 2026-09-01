import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

async function canAccessChannel(
  supabase: ReturnType<typeof supabaseAdmin>,
  channelId: string,
  employeeId: string
) {
  const { data: channel } = await supabase
    .from("channels")
    .select("id, type")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { channel: null, allowed: false };

  if (channel.type === "broadcast") {
    // Every active employee can read the broadcast channel.
    return { channel, allowed: true };
  }

  const { data: member } = await supabase
    .from("channel_members")
    .select("employee_id")
    .eq("channel_id", channelId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  return { channel, allowed: !!member };
}

/** Fetches a channel's messages, oldest first. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { channel, allowed } = await canAccessChannel(supabase, params.id, session.employeeId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized for this channel." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id, employees(name)")
    .eq("channel_id", params.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = (data ?? []).map((m) => {
    const sender = Array.isArray(m.employees) ? m.employees[0] : m.employees;
    return {
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
      senderName: sender?.name ?? "Unknown",
      isMe: m.sender_id === session.employeeId,
    };
  });

  const isManager = session.role === "manager" || session.isAdmin;
  const canPost = channel.type === "broadcast" ? isManager : true;

  return NextResponse.json(
    { channelType: channel.type, canPost, messages },
    { headers: NO_STORE }
  );
}

/** Posts a new message into a channel. Broadcast posting is manager/admin only. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { body } = await req.json();
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { channel, allowed } = await canAccessChannel(supabase, params.id, session.employeeId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized for this channel." }, { status: 403 });
  }

  if (channel.type === "broadcast") {
    const isManager = session.role === "manager" || session.isAdmin;
    if (!isManager) {
      return NextResponse.json({ error: "Only managers and admins can post to All Staff." }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ channel_id: params.id, sender_id: session.employeeId, body: body.trim() })
    .select("id, body, created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    body: data.body,
    createdAt: data.created_at,
  });
}
