import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import RoomRestocking from "./client";

export default function RoomRestockingPage() {
  const session = getSession();
  if (!session) redirect("/");
  const isManager = session.role === "manager" || session.isAdmin;
  return <RoomRestocking isManager={isManager} />;
}
