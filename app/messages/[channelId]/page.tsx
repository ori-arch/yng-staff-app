import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ThreadView from "./client";

export default function ThreadPage({ params }: { params: { channelId: string } }) {
  const session = getSession();
  if (!session) redirect("/");

  return <ThreadView channelId={params.channelId} />;
}
