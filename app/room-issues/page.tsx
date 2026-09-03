import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import RoomIssues from "./client";

/** Anyone can report a room issue (a quick photo + comment, no PIN). Managers additionally see
 * every report and can resolve them; everyone else sees only their own. */
export default function RoomIssuesPage() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  return <RoomIssues isManager={isManager} />;
}
