"use client";

import { useEffect, useState } from "react";

type WarningDetail = {
  id: string;
  employeeId: string;
  employeeName: string;
  violationDate: string;
  violationDescription: string | null;
  violationTypeName: string | null;
  levelLabel: string | null;
  typeDescription: string | null;
  recommendedAction: string | null;
  status: string;
  quarterLabel: string;
  track: "green" | "yellow" | "red" | null;
  windowLabel: string | null;
  strikeNumber: number | null;
  strikeLimit: number | null;
  active: boolean;
  employeeComments: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};
type ViolationType = { id: string; key: string; name: string; track: string };

const TRACK_META: Record<string, { emoji: string; bg: string; fg: string; label: string }> = {
  green: { emoji: "🟢", bg: "#e7f4e8", fg: "#3a7d44", label: "Green track" },
  yellow: { emoji: "🟡", bg: "#fbf1dc", fg: "#a6790a", label: "Yellow track" },
  red: { emoji: "🔴", bg: "#fbe9e8", fg: "#b3261e", label: "Red track" },
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function WarningDetail({ id, isManager }: { id: string; isManager: boolean }) {
  const [warning, setWarning] = useState<WarningDetail | null>(null);
  const [trackCount, setTrackCount] = useState(0);
  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
  const [canAcknowledge, setCanAcknowledge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [acknowledging, setAcknowledging] = useState(false);
  const [comments, setComments] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Manager edit state
  const [editing, setEditing] = useState(false);
  const [editTypeId, setEditTypeId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [voidBusy, setVoidBusy] = useState(false);

  function load() {
    fetch(`/api/warnings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setWarning(data.warning);
        setTrackCount(data.trackCount ?? 0);
        setViolationTypes(data.violationTypes ?? []);
        setCanAcknowledge(data.canAcknowledge ?? false);
        setEditDate(data.warning?.violationDate ?? "");
        setEditNote(data.warning?.violationDescription ?? "");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
  }

  async function submitAcknowledge() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/warnings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments, pin }),
      });
      const data = await res.json();
      if (res.ok) {
        setAcknowledging(false);
        setPin("");
        load();
      } else {
        setError(data.error || "Could not acknowledge.");
        setPin("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/warnings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          violationTypeId: editTypeId || undefined,
          violationDate: editDate || undefined,
          violationDescription: editNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save changes.");
        return;
      }
      setEditing(false);
      load();
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleVoid() {
    if (!warning) return;
    setVoidBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/warnings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: warning.active ? "void" : "restore" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update.");
        return;
      }
      load();
    } finally {
      setVoidBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  if (error && !warning) {
    return (
      <div className="container">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!warning) return null;

  const track = warning.track ? TRACK_META[warning.track] : null;

  return (
    <div className="container">
      <h1 className="page-title">Warning Notice</h1>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        {warning.employeeName} · {fmtDate(warning.violationDate)} · {warning.quarterLabel}
      </p>

      {!warning.active && (
        <p
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--muted)",
            background: "#f1f1f1",
            borderRadius: 8,
            padding: "6px 10px",
            display: "inline-block",
          }}
        >
          Voided — this notice does not count toward any strike total
        </p>
      )}

      {track && (
        <p style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ background: track.bg, color: track.fg, borderRadius: 999, padding: "3px 10px", fontWeight: 600, fontSize: 13 }}>
            {track.emoji} {track.label} — strike {warning.strikeNumber ?? "?"} of {warning.strikeLimit ?? "?"}
          </span>
          {warning.levelLabel && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{warning.levelLabel}</span>}
        </p>
      )}
      <p style={{ color: "var(--muted)", fontSize: 12.5 }}>
        {track ? `${trackCount} active on this track in ${warning.windowLabel}` : ""}
        {warning.strikeLimit && trackCount >= warning.strikeLimit ? " — strike limit reached" : ""}
      </p>

      <div className="card" style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Violation</p>
        <p style={{ fontSize: 14, margin: 0 }}>{warning.violationTypeName ?? "—"}</p>
        {warning.typeDescription && <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>{warning.typeDescription}</p>}
        {warning.violationDescription && (
          <p style={{ fontSize: 14, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{warning.violationDescription}</p>
        )}
        {warning.recommendedAction && (
          <>
            <p style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10, marginBottom: 2, color: "var(--muted)" }}>Recommended action</p>
            <p style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>{warning.recommendedAction}</p>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Status</p>
        <p style={{ fontSize: 14, margin: 0 }}>
          {warning.status === "acknowledged" ? (
            <>Acknowledged {warning.acknowledgedAt ? `on ${fmtDate(warning.acknowledgedAt.slice(0, 10))}` : ""}</>
          ) : (
            "Issued — awaiting acknowledgment"
          )}
        </p>
        {warning.employeeComments && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 2 }}>Employee comments</p>
            <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{warning.employeeComments}</p>
          </>
        )}
      </div>

      {canAcknowledge && !acknowledging && (
        <button className="btn" style={{ marginTop: 16 }} onClick={() => setAcknowledging(true)}>
          Acknowledge this warning
        </button>
      )}

      {canAcknowledge && acknowledging && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Comments (optional)</p>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-strong)", fontFamily: "inherit" }}
          />

          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12, textAlign: "center" }}>Re-enter your PIN to sign</p>
          <div className="pin-dots">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
            ))}
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} onClick={() => pressDigit(d)} disabled={submitting}>{d}</button>
            ))}
            <button onClick={() => { setAcknowledging(false); setPin(""); setError(null); }} style={{ fontSize: 13 }}>Cancel</button>
            <button onClick={() => pressDigit("0")} disabled={submitting}>0</button>
            <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={submitting}>⌫</button>
          </div>
          <button className="btn" style={{ marginTop: 12 }} disabled={pin.length < 4 || submitting} onClick={submitAcknowledge}>
            {submitting ? "Submitting…" : "Confirm Acknowledgment"}
          </button>
        </div>
      )}

      {isManager && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Manager controls</p>
          {error && <p className="error-text">{error}</p>}

          {!editing ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn outline sm" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="btn ghost sm" disabled={voidBusy} onClick={toggleVoid}>
                {voidBusy ? "Working…" : warning.active ? "Void this notice" : "Restore this notice"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                value={editTypeId}
                onChange={(e) => setEditTypeId(e.target.value)}
                style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5 }}
              >
                <option value="">Keep current violation type…</option>
                {violationTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {TRACK_META[t.track]?.emoji} {t.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5 }}
              />
              <input
                placeholder="Additional detail"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                style={{ padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn gold" disabled={savingEdit} onClick={saveEdit}>
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
                <button className="btn ghost" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
