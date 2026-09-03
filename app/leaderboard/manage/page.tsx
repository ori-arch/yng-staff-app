import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LeaderboardManage from "./client";

export default function LeaderboardManagePage() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) redirect("/leaderboard");
  return <LeaderboardManage />;
}
