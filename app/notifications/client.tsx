"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { enablePushNotifications, hasPushSubscription, pushSupported } from "@/lib/push-client";

type Notification = {
  id: string;
  type: "message" | "broadcast" | "task_due" | "approval_needed";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const TYPE_LABEL: Record<Notification["type"], string> = {
  message: "Message",
  broadcast: "Broadcast",
  task_due: "Task",
  approval_needed: "Needs approval",
};

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "off" | "on" | "enabling">("unknown");

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setItems(d.notifications ?? []);
          setHasMore(!!d.hasMore);
        }
      })
      .finally(() => setLoading(false));

    fetch("/api/notifications/mark-read", { method: "POST" }).catch(() => {});

    if (!pushSupported()) {
      setPushState("unsupported");
    } else {
      hasPushSubscription().then((has) => setPushState(has ? "on" : "off"));
    }
  }, []);

  function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    fetch(`/api/notifications?before=${encodeURIComponent(last.createdAt)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setItems((prev) => [...prev, ...(d.notifications ?? [])]);
          setHasMore(!!d.hasMore);
        }
      })
      .finally(() => setLoadingMore(false));
  }

  async function turnOnPush() {
    setPushState("enabling");
    const ok = await enablePushNotifications();
    setPushState(ok ? "on" : "off");
  }

  return (
    <div className="container">
      <h1 className="page-title">Notifications</h1>
      <p className="page-sub">Messages, broadcasts, and anything past due — newest first.</p>

      {pushState === "off" && (
        <div className="card" style={{ padding: 12, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13.5 }}>Get these on your phone even when the app isn&apos;t open.</span>
          <button className="btn" style={{ padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }} onClick={turnOnPush}>
            Turn on
          </button>
        </div>
      )}
      {pushState === "enabling" && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>Enabling notifications…</p>}

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty">Nothing yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => n.link && router.push(n.link)}
              className="card"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 12,
                border: n.read ? undefined : "1.5px solid var(--gold)",
                cursor: n.link ? "pointer" : "default",
                font: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span className="badge gold" style={{ fontSize: 10.5 }}>{TYPE_LABEL[n.type]}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtWhen(n.createdAt)}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginTop: 6 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{n.body}</div>}
            </button>
          ))}
          {hasMore && (
            <button className="btn outline" style={{ marginTop: 6 }} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
