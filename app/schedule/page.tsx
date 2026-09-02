import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Schedule from "./client";

/** Manager/admin schedule builder — recurring weekly patterns + one-off exceptions,
 * plus a team calendar. Staff use /my-shifts for their own read-only view. */
export default function SchedulePage() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) redirect("/my-shifts");
  return <Schedule />;
}
