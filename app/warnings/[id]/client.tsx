"use client";

import { useEffect, useState } from "react";

type WarningDetail = {
  id: string;
  employeeId: string;
  employeeName: string;
  violationDate: string;
  violationDescription: string;
  status: string;
  quarterLabel: string;
  employeeComments: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function WarningDetail({ id }: { id: string }) {
  const [warning, setWarning] = useState<WarningDetail | null>(null);
  const [quarterCount, setQuarterCount] = useState(0);
  const [canAcknowledge, setCanAcknowledge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [acknowledging, setAcknowledging] = useState(false);
  const [comments, setComments] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch(`/api/warnings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setWarning(data.warning);
        setQuarterCount(data.quarterCount ?? 0);
        setCanAcknowledge(data.canAcknowledge ?? false);
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

  if (loading) {
    return (
      <div className="container">
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  if (error && !warning) {
    return (
      <div className="container">
        <div className="top-bar">
          <a href="/warnings" className="link-button">← Warnings</a>
        </div>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!warning) return null;

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/warnings" className="link-button">← Warnings</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Warning Notice</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>
        {warning.employeeName} · {fmtDate(warning.violationDate)} · {warning.quarterLabel}
      </p>
      <p style={{ color: "#6b6b6b", fontSize: 12.5 }}>
        Warning {quarterCount} of 3 this quarter{quarterCount >= 3 ? " — probation/termination threshold reached" : ""}
      </p>

      <div className="card" style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Violation</p>
        <p style={{ fontSize: 14, margin: 0 }}>{warning.violationDescription}</p>
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
        <button className="primary" style={{ marginTop: 16 }} onClick={() => setAcknowledging(true)}>
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
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "inherit" }}
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
          <button className="primary" style={{ marginTop: 12 }} disabled={pin.length < 4 || submitting} onClick={submitAcknowledge}>
            {submitting ? "Submitting…" : "Confirm Acknowledgment"}
          </button>
        </div>
      )}
    </div>
  );
}
