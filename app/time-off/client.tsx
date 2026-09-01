"use client";

import { useEffect, useState } from "react";

type MyRequest = {
  id: string;
  startDate: string;
  endDate: string;
  hoursRequested: number;
  reason: string | null;
  status: string;
  decidedAt: string | null;
  createdAt: string;
};

type AllRequest = MyRequest & { employeeId: string; employeeName: string };

type Balance = { employeeId: string; name: string; role: string; balance: number };

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#6b6b6b",
  approved: "#1e7b34",
  denied: "#b3261e",
};

function RequestRow({ r, showName }: { r: MyRequest | AllRequest; showName: boolean }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {showName ? (r as AllRequest).employeeName : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: STATUS_COLOR[r.status] ?? "#6b6b6b", textTransform: "capitalize" }}>
          {r.status}
        </span>
      </div>
      {showName && (
        <p style={{ margin: "4px 0 0", fontSize: 13 }}>
          {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
        </p>
      )}
      <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#6b6b6b" }}>
        {r.hoursRequested} hrs{r.reason ? ` · ${r.reason}` : ""}
      </p>
    </div>
  );
}

export default function TimeOff({ isManager }: { isManager: boolean }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [allRequests, setAllRequests] = useState<AllRequest[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deciding, setDeciding] = useState<string | null>(null);

  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjustHours, setAdjustHours] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  function load() {
    fetch("/api/time-off")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setBalance(data.balance ?? 0);
        setRequests(data.requests ?? []);
        if (isManager) {
          setAllRequests(data.allRequests ?? []);
          setBalances(data.balances ?? []);
        }
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
      const res = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, hoursRequested: Number(hours), reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setStartDate("");
        setEndDate("");
        setHours("");
        setReason("");
        load();
      } else {
        setError(data.error || "Could not submit request.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(id: string, action: "approve" | "deny") {
    setDeciding(id);
    setError(null);
    try {
      const res = await fetch(`/api/time-off/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not decide request.");
    } finally {
      setDeciding(null);
    }
  }

  async function submitAdjustment(employeeId: string) {
    setAdjusting(true);
    setError(null);
    try {
      const res = await fetch("/api/time-off/balance-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, hours: Number(adjustHours), note: adjustNote }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdjustFor(null);
        setAdjustHours("");
        setAdjustNote("");
        load();
      } else {
        setError(data.error || "Could not adjust balance.");
      }
    } finally {
      setAdjusting(false);
    }
  }

  const pending = allRequests.filter((r) => r.status === "pending");

  return (
    <div className="container">
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Time Off</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Request time off and check your balance.</p>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
      ) : (
        <>
          <div className="card" style={{ marginTop: 8, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "#6b6b6b" }}>Your balance</p>
            <p style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 700 }}>{balance} hrs</p>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Request time off</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
              />
            </div>
            <input
              type="number"
              min={0}
              step="0.5"
              placeholder="Hours requested"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginTop: 8 }}
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginTop: 8 }}
            />
            <button
              className="primary"
              style={{ marginTop: 10 }}
              disabled={!startDate || !endDate || !hours || submitting}
              onClick={submitRequest}
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>

          {isManager && (
            <>
              <div className="section-label">Pending approvals</div>
              {pending.length === 0 ? (
                <p style={{ color: "#6b6b6b", fontSize: 13.5 }}>Nothing pending.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pending.map((r) => (
                    <div key={r.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{r.employeeName}</span>
                        <span style={{ fontSize: 12.5, color: "#6b6b6b" }}>{r.hoursRequested} hrs</span>
                      </div>
                      <p style={{ margin: "4px 0 8px", fontSize: 13 }}>
                        {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="primary"
                          style={{ flex: 1 }}
                          disabled={deciding === r.id}
                          onClick={() => decide(r.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          style={{ flex: 1, borderRadius: 10, border: "1px solid #b3261e", color: "#b3261e", background: "white" }}
                          disabled={deciding === r.id}
                          onClick={() => decide(r.id, "deny")}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="section-label">Team balances</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {balances.map((b) => (
                  <div key={b.employeeId} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14 }}>{b.name}</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{b.balance} hrs</span>
                    </div>
                    {adjustFor === b.employeeId ? (
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="+/- hours"
                          value={adjustHours}
                          onChange={(e) => setAdjustHours(e.target.value)}
                          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
                        />
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={adjustNote}
                          onChange={(e) => setAdjustNote(e.target.value)}
                          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, marginTop: 6 }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button
                            className="primary"
                            style={{ flex: 1, padding: 8, fontSize: 13 }}
                            disabled={!adjustHours || adjusting}
                            onClick={() => submitAdjustment(b.employeeId)}
                          >
                            Save
                          </button>
                          <button
                            style={{ flex: 1, padding: 8, fontSize: 13, borderRadius: 10, border: "1px solid #ddd", background: "white" }}
                            onClick={() => { setAdjustFor(null); setAdjustHours(""); setAdjustNote(""); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAdjustFor(b.employeeId)}
                        style={{ marginTop: 8, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "white" }}
                      >
                        Adjust
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="section-label">All requests</div>
              {allRequests.length === 0 ? (
                <p style={{ color: "#6b6b6b", fontSize: 13.5 }}>No requests yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {allRequests.map((r) => (
                    <RequestRow key={r.id} r={r} showName />
                  ))}
                </div>
              )}
            </>
          )}

          {!isManager && (
            <>
              <div className="section-label">Your requests</div>
              {requests.length === 0 ? (
                <p style={{ color: "#6b6b6b", fontSize: 13.5 }}>No requests yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {requests.map((r) => (
                    <RequestRow key={r.id} r={r} showName={false} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
