"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { enablePushNotifications, hasPushSubscription, pushSupported } from "@/lib/push-client";

type Notification = {
  id: string;
  type: "message" | "broadcast" | "task_due";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 30000;

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BellIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "off" | "on" | "enabling">("unknown");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pushSupported()) setPushState("unsupported");
    else hasPushSubscription().then((has) => setPushState(has ? "on" : "off"));
  }, []);

  async function turnOnPush() {
    setPushState("enabling");
    const ok = await enablePushNotifications();
    setPushState(ok ? "on" : "off");
  }

  function poll() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setNotifications(d.notifications ?? []);
          setUnreadCount(d.unreadCount ?? 0);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function togglePanel() {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      setLoading(true);
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return;
          setNotifications(d.notifications ?? []);
          setUnreadCount(d.unreadCount ?? 0);
          // Clear the red dot for persisted notifications now that they've
          // been seen. Past-due tasks aren't "read" this way — they keep
          // nudging (via the next poll) until the task itself is done.
          return fetch("/api/notifications/mark-read", { method: "POST" }).then(poll);
        })
        .finally(() => setLoading(false));
    }
  }

  function openNotification(n: Notification) {
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button className="icon-btn" aria-label="Notifications" onClick={togglePanel} style={{ position: "relative" }}>
        <BellIcon />
        {unreadCount > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--danger, #c0392b)",
              border: "1.5px solid #fff",
            }}
          />
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 320,
            maxWidth: "88vw",
            maxHeight: 420,
            overflowY: "auto",
            padding: 6,
            zIndex: 50,
            boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, padding: "8px 8px 4px" }}>Notifications</div>
          {pushState === "off" && (
            <div
              style={{
                margin: "0 8px 6px",
                padding: "8px 9px",
                borderRadius: 8,
                background: "var(--gold-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11.5 }}>Get these on your phone too</span>
              <button className="btn" style={{ width: "auto", padding: "5px 10px", fontSize: 11.5 }} onClick={turnOnPush}>
                Turn on
              </button>
            </div>
          )}
          {pushState === "enabling" && (
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 8px 6px" }}>Enabling notifications…</p>
          )}
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--muted)", padding: 10 }}>Loading…</p>
          ) : notifications.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", padding: 10 }}>You&apos;re all caught up.</p>
          ) : (
            notifications.slice(0, 8).map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: n.read ? "transparent" : "var(--gold-soft)",
                  cursor: n.link ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  {!n.read && (
                    <span
                      aria-hidden
                      style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger, #c0392b)", marginTop: 5, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                    {n.body && (
                      <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{fmtWhen(n.createdAt)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
          <button
            className="btn outline"
            style={{ width: "100%", marginTop: 6, padding: "8px 0", fontSize: 13 }}
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
          >
            View more
          </button>
        </div>
      )}
    </div>
  );
}
