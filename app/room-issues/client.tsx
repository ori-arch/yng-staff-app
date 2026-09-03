"use client";

import { useEffect, useState } from "react";
import PhotoCaptureField from "@/components/PhotoCaptureField";

type Room = { id: string; name: string };
type Report = {
  id: string;
  roomName: string;
  employeeName: string;
  comment: string;
  photoUrl: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
  resolverName: string | null;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function RoomIssues({ isManager }: { isManager: boolean }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [roomId, setRoomId] = useState("");
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  function loadReports() {
    setLoadingReports(true);
    fetch("/api/room-issues")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setReports(data.reports ?? []);
      })
      .finally(() => setLoadingReports(false));
  }

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setRooms(data.rooms ?? []);
      });
    loadReports();
  }, []);

  function resetForm() {
    setRoomId("");
    setComment("");
    setPhoto(null);
    setPhotoPreview(null);
  }

  async function submit() {
    setError(null);
    if (!comment.trim()) {
      setError("Describe what's wrong with the room.");
      return;
    }
    if (!photo) {
      setError("A photo is required.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("roomId", roomId);
      form.set("comment", comment.trim());
      form.set("photo", photo);
      const res = await fetch("/api/room-issues", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send this report.");
        return;
      }
      resetForm();
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3000);
      loadReports();
    } finally {
      setSubmitting(false);
    }
  }

  async function resolve(id: string) {
    const res = await fetch(`/api/room-issues/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", note: resolveNote.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setResolvingId(null);
    setResolveNote("");
    loadReports();
  }

  async function reopen(id: string) {
    const res = await fetch(`/api/room-issues/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else loadReports();
  }

  const visibleReports = filter === "open" ? reports.filter((r) => r.status === "open") : reports;

  return (
    <div className="container">
      <h1 className="page-title">Report a Room Issue</h1>
      <p className="page-sub">Room not ready for your shift? Snap a photo and let a manager know right away.</p>

      <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
          >
            <option value="">Select a room (optional)…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>What's wrong</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Not restocked, dirty, equipment missing…"
            style={{ width: "100%", minHeight: 70, padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14 }}
          />
        </div>

        <PhotoCaptureField
          label="Photo"
          preview={photoPreview}
          cameraTitle="Room Issue Photo"
          onCapture={(f) => {
            setPhoto(f);
            setPhotoPreview(URL.createObjectURL(f));
          }}
        />

        {error && <p className="error-text">{error}</p>}
        {justSubmitted && <p style={{ color: "var(--success, green)", fontSize: 13.5, margin: 0 }}>Reported — a manager has been notified. ✓</p>}

        <button className="btn gold" disabled={submitting} onClick={submit}>
          {submitting ? "Sending…" : "Send Report"}
        </button>
      </div>

      <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{isManager ? "Reports" : "Your reports"}</span>
        {isManager && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className={`btn ${filter === "open" ? "outline" : "ghost"} sm`} onClick={() => setFilter("open")}>
              Open
            </button>
            <button className={`btn ${filter === "all" ? "outline" : "ghost"} sm`} onClick={() => setFilter("all")}>
              All
            </button>
          </div>
        )}
      </div>

      {loadingReports ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : visibleReports.length === 0 ? (
        <p className="empty">{filter === "open" ? "No open reports." : "No reports yet."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleReports.map((r) => (
            <div key={r.id} className="card" style={{ display: "flex", gap: 10, opacity: r.status === "resolved" ? 0.7 : 1 }}>
              <img src={r.photoUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{r.roomName}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDateTime(r.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, margin: "2px 0" }}>{r.comment}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {r.employeeName} · {r.status === "resolved" ? `Resolved${r.resolverName ? ` by ${r.resolverName}` : ""}` : "Open"}
                  {r.resolvedNote ? ` — ${r.resolvedNote}` : ""}
                </div>
                {isManager && (
                  <div style={{ marginTop: 6 }}>
                    {r.status === "open" ? (
                      resolvingId === r.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            placeholder="Note (optional)"
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid var(--border-strong)", fontSize: 12.5 }}
                          />
                          <button className="btn outline sm" onClick={() => resolve(r.id)}>
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <button className="btn ghost sm" onClick={() => setResolvingId(r.id)}>
                          Mark resolved
                        </button>
                      )
                    ) : (
                      <button className="btn ghost sm" onClick={() => reopen(r.id)}>
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
