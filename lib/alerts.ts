import { SupabaseClient } from "@supabase/supabase-js";
import { notifyEmployees } from "@/lib/notifications";

/**
 * Posts a system-authored message (sender_id null) into the "All Staff"
 * broadcast channel. Used for task-linked alerts — a flagged low-inventory
 * item, a facilities issue, a restocked item that's at/below its par level —
 * so the whole team sees it without anyone having to remember to mention it.
 * Also fans out a bell/push notification to every active employee, same as
 * a manager-posted broadcast. Best-effort: callers should not fail their own
 * request if this fails.
 */
export async function postBroadcastAlert(supabase: SupabaseClient, body: string): Promise<void> {
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("type", "broadcast")
    .limit(1)
    .maybeSingle();
  if (!channel) return; // no broadcast channel exists yet — nothing to post into

  await supabase.from("messages").insert({ channel_id: channel.id, sender_id: null, body });

  const { data: employees } = await supabase.from("employees").select("id").eq("active", true);
  const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;
  await notifyEmployees(supabase, (employees ?? []).map((e) => e.id), {
    type: "broadcast",
    title: "Team alert",
    body: preview,
    link: `/messages/${channel.id}`,
  });
}
