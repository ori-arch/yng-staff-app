import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ReviewCycle from "./client";

export default function ReviewCyclePage({ params }: { params: { cycleId: string } }) {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  if (!isManager) redirect("/leaderboard");
  return <ReviewCycle cycleId={params.cycleId} managerName={session.name} />;
}
