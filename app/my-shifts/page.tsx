import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import MyShifts from "./client";

/** Every employee's own upcoming shifts — list + calendar. Managers/admins
 * use /schedule to build the schedule for everyone; this page shows their
 * own personal shifts the same way staff see theirs. */
export default function MyShiftsPage() {
  const session = getSession();
  if (!session) redirect("/");
  return <MyShifts />;
}
