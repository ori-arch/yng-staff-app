"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PhotoCaptureField from "@/components/PhotoCaptureField";

type Report = {
  id: string;
  description: string;
  pagePath: string | null;
  photoUrl: string | null;
  status: "open" | "fixed";
  createdAt: string;
  fixedAt: string | null;
  fixedNote: string | null;
  reporterName: string;
  fixerName: string | null;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Bugs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixNote, setFixNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadReports() {
    setLoadingReports(true);
    fetch("/api/bugs")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setReports(data.reports ?? []);
      })
      .finally(() => setLoadingReports(false));
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setDescription("");
    setPhoto(null);
    setPhotoPreview(null);
  }

  async function submit() {
    setError(null);
    if (!description.trim()) {
      setError("Describe what's broken.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("description", description.trim());
      form.set("pagePath", pathname || "");
      if (photo) form.set("photo", photo);
      const res = await fetch("/api/bugs", { method: "POST", body: form });
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

  async function markFixed(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fix", note: fixNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setFixingId(null);
      setFixNote("");
      loadReports();
    } finally {
      setBusyId(null);
    }
  }

  async function reopen(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else loadReports();
    } finally {
      setBusyId(null);
    }
  }

  const visibleReports = isOwner && filter === "open" ? reports.filter((r) => r.status === "open") : reports;

  return (
    <div className="container">
      <h1 className="page-title">Report a Bug</h1>
      <p className="page-sub">
        {isOwner ? "Everything the team has flagged, newest first." : "Something not working right? Let us know."}
      </p>

      <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>What's wrong?</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. The Confirm button on the checklist page doesn't respond"
            rows={3}
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)", fontFamily: "inherit", fontSize: 14 }}
          />
        </div>

        <PhotoCaptureField
          label="Screenshot or photo (optional)"
          preview={photoPreview}
          onCapture={(f) => { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }}
        />

        {error && <p className="error-text">{error}</p>}
        {justSubmitted && <p style={{ color: "var(--success)", fontSize: 13.5, margin: 0 }}>Reported ✓ — thanks for the heads-up.</p>}

        <button className="btn" disabled={!description.trim() || submitting} onClick={submit}>
          {submitting ? "Sending…" : "Send Report"}
        </button>
      </div>

      <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{isOwner ? "All reports" : "Your reports"}</span>
        {isOwner && (
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>Open</button>
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          </div>
        )}
      </div>

      {loadingReports ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : visibleReports.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Nothing here.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {visibleReports.map((r) => (
            <div key={r.id} className="card" style={{ display: "flex", gap: 10, opacity: r.status === "fixed" ? 0.7 : 1 }}>
              {r.photoUrl && (
                <img src={r.photoUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {r.status === "fixed" ? "✓ Fixed" : "Open"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDateTime(r.createdAt)}</span>
                </div>
                <p style={{ margin: "4px 0", fontSize: 13.5 }}>{r.description}</p>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {r.reporterName}
                  {r.pagePath ? ` · ${r.pagePath}` : ""}
                </span>
                {r.status === "fixed" && r.fixedNote && (
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>Note: {r.fixedNote}</p>
                )}

                {isOwner && r.status === "open" && (
                  fixingId === r.id ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={fixNote}
                        onChange={(e) => setFixNote(e.target.value)}
                        style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 13 }}
                      />
                      <button
                        className="btn"
                        style={{ width: "auto", padding: "0 12px" }}
                        disabled={busyId === r.id}
                        onClick={() => markFixed(r.id)}
                      >
                        {busyId === r.id ? "Saving…" : "Confirm"}
                      </button>
                      <button onClick={() => { setFixingId(null); setFixNote(""); }} style={{ fontSize: 13 }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "4px 12px", fontSize: 12.5, marginTop: 8 }}
                      onClick={() => setFixingId(r.id)}
                    >
                      Mark as fixed
                    </button>
                  )
                )}
                {isOwner && r.status === "fixed" && (
                  <button
                    style={{ fontSize: 12, color: "var(--muted)", textDecoration: "underline", padding: 0, marginTop: 6 }}
                    disabled={busyId === r.id}
                    onClick={() => reopen(r.id)}
                  >
                    {busyId === r.id ? "Saving…" : "Reopen"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
