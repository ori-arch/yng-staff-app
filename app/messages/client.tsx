"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ChannelSummary = {
  id: string;
  type: string;
  title: string;
  lastMessage: { body: string; createdAt: string; senderName: string | null } | null;
};

type EmployeeOption = { id: string; name: string; role: string };

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesList({ myEmployeeId }: { myEmployeeId: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [starting, setStarting] = useState(false);

  function loadChannels() {
    setLoading(true);
    fetch("/api/messages/channels")
      .then((r) => r.json())
      .then((data) => setChannels(data.channels ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadChannels();
  }, []);

  function openPicker() {
    setPicking(true);
    fetch("/api/employees/roster")
      .then((r) => r.json())
      .then((data) => setEmployees((data.employees ?? []).filter((e: EmployeeOption) => e.id !== myEmployeeId)));
  }

  async function startDm(otherEmployeeId: string) {
    setStarting(true);
    try {
      const res = await fetch("/api/messages/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherEmployeeId }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/messages/${data.id}`);
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Messages</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Broadcasts and direct messages.</p>

      <button
        className="tile primary-tile"
        onClick={openPicker}
        style={{ marginTop: 12, marginBottom: 12, width: "100%", textAlign: "left" }}
      >
        + New Message
      </button>

      {picking && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Message who?</p>
          {employees.length === 0 ? (
            <p style={{ color: "#6b6b6b", fontSize: 13 }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {employees.map((e) => (
                <button
                  key={e.id}
                  disabled={starting}
                  onClick={() => startDm(e.id)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "white",
                  }}
                >
                  {e.name} <span style={{ color: "#6b6b6b", fontSize: 12 }}>({e.role.replace("_", " ")})</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setPicking(false)}
            style={{ marginTop: 10, background: "none", border: "none", color: "#6b6b6b", fontSize: 13 }}
          >
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
      ) : channels.length === 0 ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>No conversations yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {channels.map((ch) => (
            <a
              key={ch.id}
              href={`/messages/${ch.id}`}
              className="card"
              style={{ display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>
                  {ch.type === "broadcast" ? "📢 " : ""}
                  {ch.title}
                </span>
                {ch.lastMessage && (
                  <span style={{ fontSize: 12, color: "#6b6b6b" }}>{fmtTime(ch.lastMessage.createdAt)}</span>
                )}
              </div>
              {ch.lastMessage ? (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b6b6b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ch.lastMessage.senderName ? `${ch.lastMessage.senderName}: ` : ""}
                  {ch.lastMessage.body}
                </p>
              ) : (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#999" }}>No messages yet.</p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
