import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Leaderboard from "./client";

/** Everyone's board -- standings, the current prize/countdown, and (for
 * front_desk/aesthetician) the five one-tap log buttons. Managers see the
 * same board plus a link into /leaderboard/manage. */
export default function LeaderboardPage() {
  const session = getSession();
  if (!session) redirect("/");

  const isManager = session.role === "manager" || session.isAdmin;
  const canLog = session.role === "front_desk" || session.role === "aesthetician";

  return <Leaderboard isManager={isManager} canLog={canLog} />;
}
