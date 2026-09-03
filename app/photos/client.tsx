"use client";

import { useEffect, useState } from "react";

type Photo = {
  id: string;
  url: string;
  category: "checklist" | "equipment" | "room_restocking" | "room_issue";
  categoryLabel: string;
  context: string;
  employeeName: string | null;
  takenAt: string;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "checklist", label: "Checklists" },
  { key: "equipment", label: "Equipment" },
  { key: "room_restocking", label: "Room Restocking" },
  { key: "room_issue", label: "Room Issues" },
] as const;

function fmtWhen(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Photos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [open, setOpen] = useState<Photo | null>(null);

  useEffect(() => {
    fetch("/api/admin/photos")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPhotos(data.photos ?? []);
      })
      .catch(() => setError("Could not load photos. Check your connection."))
      .finally(() => setLoading(false));
  }, []);

  const shown = filter === "all" ? photos : photos.filter((p) => p.category === filter);

  return (
    <div className="container">
      <h1 className="page-title">Photos</h1>
      <p className="page-sub">Every photo staff have taken, newest first — checklists, equipment, room restocking.</p>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? "active" : ""} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="empty">No photos yet in this category.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            marginTop: 14,
          }}
        >
          {shown.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpen(p)}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                aspectRatio: "1 / 1",
                position: "relative",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <img
                src={p.url}
                alt={p.context}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "12px 5px 4px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.employeeName ?? "Unknown"}
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)" }}>{fmtWhen(p.takenAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="sheet-handle" />
            <img
              src={open.url}
              alt={open.context}
              style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: 14, background: "var(--surface)" }}
            />
            <div style={{ marginTop: 12 }}>
              <span className="badge gold">{open.categoryLabel}</span>
              <p style={{ fontWeight: 600, fontSize: 15.5, margin: "8px 0 2px" }}>{open.context}</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{open.employeeName ?? "Unknown"}</p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>{fmtWhen(open.takenAt)}</p>
            </div>
            <button className="btn outline" style={{ marginTop: 14 }} onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
