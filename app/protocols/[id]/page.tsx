import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ProtocolDetail from "./client";

export default function ProtocolDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) redirect("/");

  const isManager = session.role === "manager" || session.isAdmin;
  return <ProtocolDetail id={params.id} isManager={isManager} />;
}
