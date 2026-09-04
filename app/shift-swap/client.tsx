"use client";

import { useEffect, useState } from "react";

type SwapShift = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roomId: string | null;
  roomName: string | null;
  accepted: boolean | null;
  ownerApproved: boolean;
  reofferedSwapRequestId: string | null;
};

type Swap = {
  id: string;
  requestingEmployeeId: string;
  requestingEmployeeName: string;
  targetEmployeeId: string;
  targetEmployeeName: string;
  shiftDescription: string | null;
  status: string;
  coworkerRespondedAt: string | null;
  ownerDecidedAt: string | null;
  createdAt: string;
  shifts: SwapShift[];
};

type Coworker = { id: string; name: string; role: string };

type MyShift = {
  date: string;
  startTime: string;
  endTime: string;
  roomId: string | null;
  roomName: string | null;
};

function fmtShiftDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function shiftLabel(s: { shiftDate: string; startTime: string; endTime: string; roomName?: string | null }) {
  const room = s.roomName ? ` · ${s.roomName}` : "";
  return `${fmtShiftDate(s.shiftDate)} · ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}${room}`;
}

function totalHours(shifts: { startTime: string; endTime: string }[]) {
  const mins = shifts.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);
  return Math.round((mins / 60) * 100) / 100;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending_coworker: { label: "Awaiting coworker", color: "var(--muted)" },
  pending_owner: { label: "Awaiting manager", color: "var(--warn)" },
  approved: { label: "Approved", color: "var(--success)" },
  denied: { label: "Denied", color: "var(--danger)" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: "var(--muted)" };
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: s.color }}>{s.label}</span>;
}

export default function ShiftSwap({ isManager, myEmployeeId }: { isManager: boolean; myEmployeeId: string }) {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [coworkers, setCoworkers] = useState<Coworker[]>([]);
  const [myShifts, setMyShifts] = useState<MyShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [targetId, setTargetId] = useState("");
  const [selectedShiftKeys, setSelectedShiftKeys] = useState<Set<string>>(new Set());
  const [shiftDescription, setShiftDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Which shifts the coworker is choosing to accept, per pending request.
  const [responseSelections, setResponseSelections] = useState<Record<string, Set<string>>>({});

  // Re-offering a specific not-accepted shift to a different coworker.
  const [reoffering, setReoffering] = useState<{ shiftId: string; date: string; startTime: string; endTime: string; roomId: string | null } | null>(null);
  const [reofferTargetId, setReofferTargetId] = useState("");
  const [reofferSubmitting, setReofferSubmitting] = useState(false);

  function load() {
    const start = new Date().toISOString().slice(0, 10);
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() + 60);
    const end = endDate.toISOString().slice(0, 10);
    Promise.all([
      fetch("/api/shift-swap").then((r) => r.json()),
      fetch("/api/employees/roster").then((r) => r.json()),
      fetch(`/api/schedule?start=${start}&end=${end}`).then((r) => r.json()),
    ])
      .then(([swapData, rosterData, scheduleData]) => {
        if (swapData.error) {
          setError(swapData.error);
          return;
        }
        setSwaps(swapData.swaps ?? []);
        const others = (rosterData.employees ?? []).filter(
          (e: Coworker & { role: string }) => e.id !== myEmployeeId && e.role !== "manager"
        );
        setCoworkers(others);
        if (!scheduleData.error) {
          setMyShifts(
            (scheduleData.shifts ?? []).map((s: any) => ({
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              roomId: s.roomId,
              roomName: s.roomName,
            }))
          );
        }
        // Default every awaiting-response request to "everything selected".
        setResponseSelections((prev) => {
          const next = { ...prev };
          for (const s of swapData.swaps ?? []) {
            if (s.status === "pending_coworker" && s.targetEmployeeId === myEmployeeId && !next[s.id]) {
              next[s.id] = new Set(s.shifts.map((sh: SwapShift) => sh.id));
            }
          }
          return next;
        });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleShiftKey(k: string) {
    setSelectedShiftKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function submitRequest() {
    const shifts = myShifts
      .filter((s) => selectedShiftKeys.has(`${s.date}|${s.startTime}|${s.endTime}`))
      .map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime, roomId: s.roomId }));
    if (shifts.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shift-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmployeeId: targetId, shiftDescription, shifts }),
      });
      const data = await res.json();
      if (res.ok) {
        setTargetId("");
        setSelectedShiftKeys(new Set());
        setShiftDescription("");
        load();
      } else {
        setError(data.error || "Could not submit swap request.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function respond(swapId: string, action: "accept" | "decline") {
    setActing(swapId);
    setError(null);
    setWarning(null);
    try {
      const acceptedShiftIds = Array.from(responseSelections[swapId] ?? []);
      const res = await fetch(`/api/shift-swap/${swapId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, acceptedShiftIds }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.warning) setWarning(data.warning);
        load();
      } else setError(data.error || "Could not update swap request.");
    } finally {
      setActing(null);
    }
  }

  async function decide(swapId: string, action: "approve" | "deny") {
    setActing(swapId);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/shift-swap/${swapId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.warning) setWarning(data.warning);
        load();
      } else setError(data.error || "Could not update swap request.");
    } finally {
      setActing(null);
    }
  }

  async function submitReoffer() {
    if (!reoffering || !reofferTargetId) return;
    setReofferSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shift-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmployeeId: reofferTargetId,
          shifts: [{ date: reoffering.date, startTime: reoffering.startTime, endTime: reoffering.endTime, roomId: reoffering.roomId }],
          reofferShiftId: reoffering.shiftId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReoffering(null);
        setReofferTargetId("");
        load();
      } else {
        setError(data.error || "Could not re-offer this shift.");
      }
    } finally {
      setReofferSubmitting(false);
    }
  }

  const myAwaitingResponse = swaps.filter((s) => s.status === "pending_coworker" && s.targetEmployeeId === myEmployeeId);
  const mySwaps = swaps.filter((s) => s.requestingEmployeeId === myEmployeeId || s.targetEmployeeId === myEmployeeId);
  const awaitingOwner = swaps.filter((s) => s.status === "pending_owner");
  const selectedShifts = myShifts.filter((s) => selectedShiftKeys.has(`${s.date}|${s.startTime}|${s.endTime}`));

  return (
    <div className="container">
      <h1 className="page-title">Shift Swap</h1>
      <p className="page-sub">{isManager ? "Approve swaps your team has already agreed on." : "Request to swap one or more shifts with a coworker."}</p>

      {error && <p className="error-text">{error}</p>}
      {warning && <p style={{ color: "var(--warn, #a86b1f)", fontSize: 13.5 }}>{warning}</p>}

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : (
        <>
          {!isManager && myAwaitingResponse.length > 0 && (
            <>
              <div className="section-label">Needs your response</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myAwaitingResponse.map((s) => {
                  const selection = responseSelections[s.id] ?? new Set<string>();
                  return (
                    <div key={s.id} className="card">
                      <p style={{ margin: 0, fontSize: 14 }}>
                        <strong>{s.requestingEmployeeName}</strong> wants to swap {s.shifts.length > 1 ? `${s.shifts.length} shifts` : "a shift"} with you
                      </p>
                      {s.shiftDescription && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{s.shiftDescription}</p>}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                        {s.shifts.map((sh) => (
                          <button
                            key={sh.id}
                            onClick={() => {
                              setResponseSelections((prev) => {
                                const next = { ...prev };
                                const set = new Set(next[s.id] ?? []);
                                if (set.has(sh.id)) set.delete(sh.id);
                                else set.add(sh.id);
                                next[s.id] = set;
                                return next;
                              });
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 8, borderRadius: 8, border: "1px solid #eee" }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                minWidth: 18,
                                borderRadius: 5,
                                border: "2px solid var(--ink)",
                                background: selection.has(sh.id) ? "var(--ink)" : "transparent",
                              }}
                            />
                            <span style={{ fontSize: 13.5 }}>{shiftLabel(sh)}</span>
                          </button>
                        ))}
                      </div>
                      {s.shifts.length > 1 && (
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
                          Uncheck any shift you don't want to cover — you can accept just some of them.
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          className="btn"
                          style={{ flex: 1 }}
                          disabled={acting === s.id || selection.size === 0}
                          onClick={() => respond(s.id, "accept")}
                        >
                          Accept {selection.size > 0 && selection.size < s.shifts.length ? `(${selection.size})` : ""}
                        </button>
                        <button
                          style={{ flex: 1, borderRadius: 10, border: "1px solid var(--danger)", color: "var(--danger)", background: "white" }}
                          disabled={acting === s.id}
                          onClick={() => respond(s.id, "decline")}
                        >
                          Decline all
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!isManager && (
            <div className="card" style={{ marginTop: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Request a swap</p>
              {myShifts.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  You don't have any upcoming shifts in the next 60 days to swap. Check My Shifts, or ask a manager
                  to add you to the schedule first.
                </p>
              ) : (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Which of your shifts? (pick one or more)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {myShifts.map((s) => {
                      const k = `${s.date}|${s.startTime}|${s.endTime}`;
                      const checked = selectedShiftKeys.has(k);
                      return (
                        <button
                          key={k}
                          onClick={() => toggleShiftKey(k)}
                          style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 8, borderRadius: 8, border: "1px solid #eee" }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              minWidth: 18,
                              borderRadius: 5,
                              border: "2px solid var(--ink)",
                              background: checked ? "var(--ink)" : "transparent",
                            }}
                          />
                          <span style={{ fontSize: 13.5 }}>{shiftLabel({ shiftDate: s.date, startTime: s.startTime, endTime: s.endTime, roomName: s.roomName })}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedShifts.length > 0 && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      {selectedShifts.length} shift{selectedShifts.length === 1 ? "" : "s"} selected · {totalHours(selectedShifts)} hours total
                    </p>
                  )}
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginTop: 8, display: "block" }}>Swap with</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-strong)", marginTop: 4 }}
                  >
                    <option value="">Swap with…</option>
                    {coworkers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Note for them (optional)"
                    value={shiftDescription}
                    onChange={(e) => setShiftDescription(e.target.value)}
                    rows={2}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-strong)", fontFamily: "inherit", marginTop: 8 }}
                  />
                  <button
                    className="btn"
                    style={{ marginTop: 10 }}
                    disabled={!targetId || selectedShifts.length === 0 || submitting}
                    onClick={submitRequest}
                  >
                    {submitting ? "Sending…" : `Send Request${selectedShifts.length > 1 ? ` (${selectedShifts.length} shifts)` : ""}`}
                  </button>
                </>
              )}
            </div>
          )}

          {isManager && (
            <>
              <div className="section-label">Awaiting your approval</div>
              {awaitingOwner.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Nothing pending.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {awaitingOwner.map((s) => {
                    const agreed = s.shifts.filter((sh) => sh.accepted);
                    return (
                      <div key={s.id} className="card">
                        <p style={{ margin: 0, fontSize: 14 }}>
                          <strong>{s.requestingEmployeeName}</strong> ↔ <strong>{s.targetEmployeeName}</strong>
                        </p>
                        <div style={{ margin: "6px 0", display: "flex", flexDirection: "column", gap: 3 }}>
                          {agreed.map((sh) => (
                            <span key={sh.id} style={{ fontSize: 13, color: "var(--muted)" }}>
                              {shiftLabel(sh)}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn" style={{ flex: 1 }} disabled={acting === s.id} onClick={() => decide(s.id, "approve")}>
                            Approve
                          </button>
                          <button
                            style={{ flex: 1, borderRadius: 10, border: "1px solid var(--danger)", color: "var(--danger)", background: "white" }}
                            disabled={acting === s.id}
                            onClick={() => decide(s.id, "deny")}
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="section-label">{isManager ? "All swap requests" : "Your swap history"}</div>
          {(isManager ? swaps : mySwaps).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>No swap requests yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(isManager ? swaps : mySwaps).map((s) => {
                const iAmRequester = s.requestingEmployeeId === myEmployeeId;
                const decided = s.status === "approved" || s.status === "denied";
                return (
                  <div key={s.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {s.requestingEmployeeName} ↔ {s.targetEmployeeName}
                      </span>
                      <StatusBadge status={s.status} />
                    </div>
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                      {s.shifts.map((sh) => {
                        const notAccepted = decided && !sh.accepted;
                        const canReoffer = !isManager && iAmRequester && notAccepted && !sh.reofferedSwapRequestId;
                        return (
                          <div key={sh.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, color: notAccepted ? "var(--danger)" : "var(--muted)" }}>
                              {shiftLabel(sh)}
                              {sh.accepted === false && s.status !== "denied" ? " · not accepted" : ""}
                              {sh.reofferedSwapRequestId ? " · re-offered" : ""}
                            </span>
                            {canReoffer && (
                              <button
                                onClick={() =>
                                  setReoffering({ shiftId: sh.id, date: sh.shiftDate, startTime: sh.startTime, endTime: sh.endTime, roomId: sh.roomId })
                                }
                                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                              >
                                Offer to someone else
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {reoffering && (
        <div className="sheet-backdrop" onClick={() => setReoffering(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 style={{ fontSize: 18, textAlign: "center" }}>Offer this shift to someone else</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", margin: "4px 0 12px" }}>
              {shiftLabel({ shiftDate: reoffering.date, startTime: reoffering.startTime, endTime: reoffering.endTime })}
            </p>
            <select
              value={reofferTargetId}
              onChange={(e) => setReofferTargetId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-strong)" }}
            >
              <option value="">Swap with…</option>
              {coworkers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ flex: 1 }} disabled={!reofferTargetId || reofferSubmitting} onClick={submitReoffer}>
                {reofferSubmitting ? "Sending…" : "Send Request"}
              </button>
              <button
                style={{ flex: 1, borderRadius: 10, border: "1px solid var(--border-strong)", background: "white" }}
                onClick={() => setReoffering(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
