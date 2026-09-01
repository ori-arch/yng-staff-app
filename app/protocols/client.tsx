"use client";

import { useEffect, useState } from "react";

type Protocol = {
  id: string;
  title: string;
  category: string | null;
  hasFile: boolean;
  hasBody: boolean;
  version: number;
  uploadedByName: string | null;
};

export default function ProtocolsList({ isManager }: { isManager: boolean }) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/protocols?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) setProtocols(data.protocols ?? []);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, category]);

  const categories = Array.from(new Set(protocols.map((p) => p.category).filter(Boolean))) as string[];

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Protocols</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Treatment protocol library.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search protocols…"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {isManager && (
        <a href="/protocols/new" className="tile primary-tile" style={{ marginTop: 12 }}>
          + New / Update Protocol
        </a>
      )}

      {loading ? (
        <p style={{ color: "#6b6b6b", fontSize: 14, marginTop: 16 }}>Loading…</p>
      ) : protocols.length === 0 ? (
        <p style={{ color: "#6b6b6b", fontSize: 14, marginTop: 16 }}>No protocols yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {protocols.map((p) => (
            <a key={p.id} href={`/protocols/${p.id}`} className="card" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.title}</span>
                <span style={{ fontSize: 12, color: "#6b6b6b" }}>v{p.version}</span>
              </div>
              <span style={{ fontSize: 12.5, color: "#6b6b6b" }}>
                {p.category ? `${p.category} · ` : ""}
                {p.hasFile ? "File" : "Text"}
                {p.uploadedByName ? ` · by ${p.uploadedByName}` : ""}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
