"use client";

import { useEffect, useState } from "react";

type Swap = {
  id: string;
  requestingEmployeeId: string;
  requestingEmployeeName: string;
  targetEmployeeId: string;
  targetEmployeeName: string;
  shiftDescription: string;
  status: string;
  coworkerRespondedAt: string | null;
  ownerDecidedAt: string | null;
  createdAt: string;
};

type Coworker = { id: string; name: string; role: string };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending_coworker: { label: "Awaiting coworker", color: "#6b6b6b" },
  pending_owner: { label: "Awaiting manager", color: "#b3730f" },
  approved: { label: "Approved", color: "#1e7b34" },
  denied: { label: "Denied", color: "#b3261e" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: "#6b6b6b" };
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: s.color }}>{s.label}</span>;
}

export default function ShiftSwap({ isManager, myEmployeeId }: { isManager: boolean; myEmployeeId: string }) {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [coworkers, setCoworkers] = useState<Coworker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [targetId, setTargetId] = useState("");
  const [shiftDescription, setShiftDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    Promise.all([
      fetch("/api/shift-swap").then((r) => r.json()),
      fetch("/api/employees/roster").then((r) => r.json()),
    ])
      .then(([swapData, rosterData]) => {
        if (swapData.error) {
          setError(swapData.error);
          return;
        }
        setSwaps(swapData.swaps ?? []);
        const others = (rosterData.employees ?? []).filter(
          (e: Coworker & { role: string }) => e.id !== myEmployeeId && e.role !== "manager"
        );
        setCoworkers(others);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitRequest() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shift-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmployeeId: targetId, shiftDescription }),
      });
      const data = await res.json();
      if (res.ok) {
        setTargetId("");
        setShiftDescription("");
        load();
      } else {
        setError(data.error || "Could not submit swap request.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function act(id: string, action: "accept" | "decline" | "approve" | "deny") {
    setActing(id);
    setError(null);
    try {
      const res = await fetch(`/api/shift-swap/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update swap request.");
    } finally {
      setActing(null);
    }
  }

  const myAwaitingResponse = swaps.filter((s) => s.status === "pending_coworker" && s.targetEmployeeId === myEmployeeId);
  const mySwaps = swaps.filter((s) => s.requestingEmployeeId === myEmployeeId || s.targetEmployeeId === myEmployeeId);
  const awaitingOwner = swaps.filter((s) => s.status === "pending_owner");

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Shift Swap</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Request to swap a shift with a coworker.</p>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
      ) : (
        <>
          {!isManager && (
            <div className="card" style={{ marginTop: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Request a swap</p>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
              >
                <option value="">Swap with…</option>
                {coworkers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <textarea
                placeholder="Which shift, and what you're proposing"
                value={shiftDescription}
                onChange={(e) => setShiftDescription(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "inherit", marginTop: 8 }}
              />
              <button
                className="primary"
                style={{ marginTop: 10 }}
                disabled={!targetId || !shiftDescription.trim() || submitting}
                onClick={submitRequest}
              >
                {submitting ? "Sending…" : "Send Request"}
              </button>
            </div>
          )}

          {!isManager && myAwaitingResponse.length > 0 && (
            <>
              <div className="section-label">Needs your response</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myAwaitingResponse.map((s) => (
                  <div key={s.id} className="card">
                    <p style={{ margin: 0, fontSize: 14 }}>
                      <strong>{s.requestingEmployeeName}</strong> wants to swap with you
                    </p>
                    <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#6b6b6b" }}>{s.shiftDescription}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="primary" style={{ flex: 1 }} disabled={acting === s.id} onClick={() => act(s.id, "accept")}>
                        Accept
                      </button>
                      <button
                        style={{ flex: 1, borderRadius: 10, border: "1px solid #b3261e", color: "#b3261e", background: "white" }}
                        disabled={acting === s.id}
                        onClick={() => act(s.id, "decline")}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {isManager && (
            <>
              <div className="section-label">Awaiting your approval</div>
              {awaitingOwner.length === 0 ? (
                <p style={{ color: "#6b6b6b", fontSize: 13.5 }}>Nothing pending.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {awaitingOwner.map((s) => (
                    <div key={s.id} className="card">
                      <p style={{ margin: 0, fontSize: 14 }}>
                        <strong>{s.requestingEmployeeName}</strong> ↔ <strong>{s.targetEmployeeName}</strong>
                      </p>
                      <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#6b6b6b" }}>{s.shiftDescription}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="primary" style={{ flex: 1 }} disabled={acting === s.id} onClick={() => act(s.id, "approve")}>
                          Approve
                        </button>
                        <button
                          style={{ flex: 1, borderRadius: 10, border: "1px solid #b3261e", color: "#b3261e", background: "white" }}
                          disabled={acting === s.id}
                          onClick={() => act(s.id, "deny")}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="section-label">{isManager ? "All swap requests" : "Your swap history"}</div>
          {(isManager ? swaps : mySwaps).length === 0 ? (
            <p style={{ color: "#6b6b6b", fontSize: 13.5 }}>No swap requests yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(isManager ? swaps : mySwaps).map((s) => (
                <div key={s.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {s.requestingEmployeeName} ↔ {s.targetEmployeeName}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b6b6b" }}>{s.shiftDescription}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
