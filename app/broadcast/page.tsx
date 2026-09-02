import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Broadcast from "./client";

/** Manager/admin-only: send an announcement to All Staff, with reusable templates. Separate from Messages (DMs + read-only All Staff history). */
export default function BroadcastPage() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) redirect("/dashboard");
  return <Broadcast />;
}
