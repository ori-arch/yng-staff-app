"use client";

import { useEffect, useState } from "react";

type Detail = {
  id: string;
  title: string;
  category: string | null;
  fileUrl: string | null;
  bodyText: string | null;
  version: number;
  archived: boolean;
  uploadedByName: string | null;
};

type HistoryEntry = {
  id: string;
  version: number;
  archived: boolean;
  createdAt: string;
  uploadedByName: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function ProtocolDetail({ id, isManager }: { id: string; isManager: boolean }) {
  const [protocol, setProtocol] = useState<Detail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/protocols/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setProtocol(data.protocol);
          setHistory(data.history ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/protocols" className="link-button">← Protocols</a>
      </div>

      {loading ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : protocol ? (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>{protocol.title}</h1>
          <p style={{ color: "#6b6b6b", fontSize: 14 }}>
            {protocol.category ? `${protocol.category} · ` : ""}v{protocol.version}
            {protocol.uploadedByName ? ` · uploaded by ${protocol.uploadedByName}` : ""}
            {protocol.archived ? " · archived (superseded by a newer version)" : ""}
          </p>

          {isManager && (
            <a href="/protocols/new" className="link-button" style={{ display: "inline-block", marginBottom: 8 }}>
              Upload New Version
            </a>
          )}

          <div className="card" style={{ marginTop: 8 }}>
            {protocol.bodyText && (
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>{protocol.bodyText}</p>
            )}
            {protocol.fileUrl && (
              <a
                href={protocol.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="link-button"
                style={{ display: "inline-block", marginTop: protocol.bodyText ? 12 : 0 }}
              >
                Open attached file →
              </a>
            )}
          </div>

          {history.length > 1 && (
            <>
              <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Version history</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {history.map((h) => (
                  <a
                    key={h.id}
                    href={`/protocols/${h.id}`}
                    className="card"
                    style={{ display: "flex", justifyContent: "space-between", opacity: h.id === protocol.id ? 1 : 0.7 }}
                  >
                    <span style={{ fontSize: 13.5 }}>
                      v{h.version}
                      {h.id === protocol.id ? " (viewing)" : h.archived ? " (archived)" : " (current)"}
                    </span>
                    <span style={{ fontSize: 12, color: "#6b6b6b" }}>
                      {fmtDate(h.createdAt)}
                      {h.uploadedByName ? ` · ${h.uploadedByName}` : ""}
                    </span>
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
