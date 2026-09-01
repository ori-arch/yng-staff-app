"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  isMe: boolean;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ThreadView({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelType, setChannelType] = useState<string | null>(null);
  const [canPost, setCanPost] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  function load() {
    fetch(`/api/messages/channels/${channelId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setMessages(data.messages ?? []);
        setChannelType(data.channelType);
        setCanPost(data.canPost);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // Light polling so a DM/broadcast feels reasonably live without websockets.
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/channels/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraft("");
        load();
      } else {
        setError(data.error || "Could not send message.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div className="top-bar">
        <a href="/messages" className="link-button">← Messages</a>
      </div>
      {channelType === "broadcast" && (
        <p style={{ color: "#6b6b6b", fontSize: 13, marginTop: -4 }}>📢 All Staff — visible to everyone</p>
      )}

      {error && <p className="error-text">{error}</p>}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, marginTop: 8, marginBottom: 12 }}>
        {loading ? (
          <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "#6b6b6b", fontSize: 14 }}>No messages yet — say hello.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.isMe ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: m.isMe ? "#111" : "#f1f1f1",
                color: m.isMe ? "white" : "#111",
                borderRadius: 12,
                padding: "8px 12px",
              }}
            >
              {!m.isMe && (
                <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, marginBottom: 2 }}>{m.senderName}</div>
              )}
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.body}</div>
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{fmtTime(m.createdAt)}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <div style={{ display: "flex", gap: 8, position: "sticky", bottom: 12 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "inherit", resize: "none" }}
          />
          <button className="primary" onClick={send} disabled={sending || !draft.trim()} style={{ width: "auto", padding: "0 16px" }}>
            Send
          </button>
        </div>
      ) : (
        <p style={{ color: "#6b6b6b", fontSize: 13, textAlign: "center" }}>
          Only managers can post to All Staff.
        </p>
      )}
    </div>
  );
}
