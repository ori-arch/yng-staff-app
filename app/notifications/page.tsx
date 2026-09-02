import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Notifications from "./client";

export default function NotificationsPage() {
  const session = getSession();
  if (!session) redirect("/");
  return <Notifications />;
}
