import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import WarningDetail from "./client";

export default function WarningDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) redirect("/");

  return <WarningDetail id={params.id} />;
}
