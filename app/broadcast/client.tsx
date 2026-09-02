"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Template = { id: string; title: string; body: string };

export default function Broadcast() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/broadcast-templates").then((r) => r.json()),
      fetch("/api/messages/channels").then((r) => r.json()),
    ])
      .then(([tpl, ch]) => {
        if (tpl.error) setError(tpl.error);
        else setTemplates(tpl.templates ?? []);
        if (ch.error) setError(ch.error);
        else {
          const broadcast = (ch.channels ?? []).find((c: { type: string }) => c.type === "broadcast");
          setChannelId(broadcast?.id ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function pickTemplate(t: Template) {
    setSelectedId(t.id);
    setDraft(t.body);
  }

  async function send() {
    if (!channelId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/channels/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send.");
        return;
      }
      setSent(true);
      setDraft("");
      setSelectedId(null);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="container"><p className="empty">Loading…</p></div>;

  return (
    <div className="container">
      <h1 className="page-title">Send a Broadcast</h1>
      <p className="page-sub">Goes to every active employee on &quot;All Staff&quot; — everyone gets a notification.</p>

      {error && <p className="error-text">{error}</p>}
      {sent && (
        <div className="card gold" style={{ padding: 12, marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 13.5 }}>Sent — your team will see it in Messages and get notified.</p>
        </div>
      )}

      <div className="section-label">Templates</div>
      {templates.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
          No templates yet — add some in Admin Panel → Broadcast Templates, or just write your own below.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t)}
              className="card"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 10,
                cursor: "pointer",
                border: selectedId === t.id ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                background: selectedId === t.id ? "var(--gold-soft)" : "#fff",
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.title}</div>
              {t.body && (
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.body}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="section-label">Message</div>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSelectedId(null);
        }}
        placeholder="Tap a template above to start from it, or write your own announcement…"
        rows={5}
        style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border-strong)", padding: 12, fontSize: 14, resize: "vertical" }}
      />

      <button className="btn gold" style={{ marginTop: 12 }} onClick={send} disabled={sending || !draft.trim() || !channelId}>
        {sending ? "Sending…" : "Send to All Staff"}
      </button>

      <button
        className="btn outline"
        style={{ marginTop: 8 }}
        onClick={() => channelId && router.push(`/messages/${channelId}`)}
        disabled={!channelId}
      >
        View All Staff history
      </button>
    </div>
  );
}
