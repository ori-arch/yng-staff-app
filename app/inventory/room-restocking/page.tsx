"use client";

import { useEffect, useState } from "react";
import PhotoCaptureField from "@/components/PhotoCaptureField";

type Room = { id: string; name: string };

type Log = {
  id: string;
  itemType: string | null;
  specificItem: string;
  remainingQuantity: string | null;
  emptyBottlePhotoUrl: string | null;
  newItemPhotoUrl: string | null;
  noReplacement: boolean;
  createdAt: string;
  employeeName: string | null;
  roomRanOut: string | null;
  roomRestocked: string | null;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function RoomRestockingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [itemType, setItemType] = useState("");
  const [specificItem, setSpecificItem] = useState("");
  const [roomRanOutId, setRoomRanOutId] = useState("");
  const [roomRestockedId, setRoomRestockedId] = useState("");
  const [remainingQuantity, setRemainingQuantity] = useState("");
  const [sharpieRoom, setSharpieRoom] = useState(false);
  const [sharpieDate, setSharpieDate] = useState(false);
  const [sharpieInitials, setSharpieInitials] = useState(false);
  const [emptyBottlePhoto, setEmptyBottlePhoto] = useState<File | null>(null);
  const [emptyBottlePreview, setEmptyBottlePreview] = useState<string | null>(null);
  const [noReplacement, setNoReplacement] = useState(false);
  const [newItemPhoto, setNewItemPhoto] = useState<File | null>(null);
  const [newItemPreview, setNewItemPreview] = useState<string | null>(null);

  const [signing, setSigning] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  function loadLogs() {
    setLoadingLogs(true);
    fetch("/api/inventory/room-restocking")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setLogs(data.logs ?? []);
      })
      .finally(() => setLoadingLogs(false));
  }

  useEffect(() => {
    fetch("/api/rooms").then((r) => r.json()).then((data) => {
      if (!data.error) setRooms(data.rooms ?? []);
    });
    loadLogs();
  }, []);

  function resetForm() {
    setItemType("");
    setSpecificItem("");
    setRoomRanOutId("");
    setRoomRestockedId("");
    setRemainingQuantity("");
    setSharpieRoom(false);
    setSharpieDate(false);
    setSharpieInitials(false);
    setEmptyBottlePhoto(null);
    setEmptyBottlePreview(null);
    setNoReplacement(false);
    setNewItemPhoto(null);
    setNewItemPreview(null);
    setSigning(false);
    setPin("");
  }

  function tryOpenSign() {
    setError(null);
    if (!specificItem.trim()) {
      setError("Enter which item was restocked (or which item is missing).");
      return;
    }
    if (!sharpieRoom || !sharpieDate || !sharpieInitials) {
      setError("All three sharpie-label confirmations are required.");
      return;
    }
    if (!emptyBottlePhoto) {
      setError("A photo of the empty bottle is required.");
      return;
    }
    if (!noReplacement && !newItemPhoto) {
      setError("A photo of the replacement item is required (or flag that there's no replacement).");
      return;
    }
    setSigning(true);
  }

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    setError(null);
    setPin((p) => p + d);
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("itemType", itemType);
      form.set("specificItem", specificItem);
      form.set("roomRanOutId", roomRanOutId);
      form.set("roomRestockedId", roomRestockedId);
      form.set("remainingQuantity", remainingQuantity);
      form.set("sharpieRoom", String(sharpieRoom));
      form.set("sharpieDate", String(sharpieDate));
      form.set("sharpieInitials", String(sharpieInitials));
      form.set("noReplacement", String(noReplacement));
      form.set("pin", pin);
      if (emptyBottlePhoto) form.set("emptyBottlePhoto", emptyBottlePhoto);
      if (newItemPhoto) form.set("newItemPhoto", newItemPhoto);

      const res = await fetch("/api/inventory/room-restocking", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save this log.");
        setPin("");
        return;
      }
      resetForm();
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3000);
      loadLogs();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">Room Restocking Log</h1>
      <p className="page-sub">Log a pulled item and its replacement.</p>

      {!signing ? (
        <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Item type (optional)</label>
            <input
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              placeholder="e.g. Backbar, Retail"
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Specific item</label>
            <input
              value={specificItem}
              onChange={(e) => setSpecificItem(e.target.value)}
              placeholder="e.g. Witch hazel"
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Room ran out</label>
              <select
                value={roomRanOutId}
                onChange={(e) => setRoomRanOutId(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
              >
                <option value="">Select…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Room restocked</label>
              <select
                value={roomRestockedId}
                onChange={(e) => setRoomRestockedId(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
              >
                <option value="">Select…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Remaining central-inventory count</label>
            <input
              value={remainingQuantity}
              onChange={(e) => setRemainingQuantity(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Sharpie-label confirmation</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {[
                { label: "Room number labeled", val: sharpieRoom, set: setSharpieRoom },
                { label: "Date labeled", val: sharpieDate, set: setSharpieDate },
                { label: "Initials labeled", val: sharpieInitials, set: setSharpieInitials },
              ].map((c) => (
                <button
                  key={c.label}
                  onClick={() => c.set(!c.val)}
                  style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 8, borderRadius: 8, border: "1px solid #eee" }}
                >
                  <span style={{ width: 18, height: 18, minWidth: 18, borderRadius: 5, border: "2px solid var(--ink)", background: c.val ? "var(--ink)" : "transparent" }} />
                  <span style={{ fontSize: 14 }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <PhotoCaptureField
            label="Photo of the empty bottle (before disposal)"
            preview={emptyBottlePreview}
            onCapture={(f) => { setEmptyBottlePhoto(f); setEmptyBottlePreview(URL.createObjectURL(f)); }}
          />

          <button
            onClick={() => {
              setNoReplacement((v) => !v);
              if (!noReplacement) {
                setNewItemPhoto(null);
                setNewItemPreview(null);
              }
            }}
            style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 8, borderRadius: 8, border: "1px solid #eee" }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                minWidth: 18,
                borderRadius: 5,
                border: "2px solid var(--danger)",
                background: noReplacement ? "var(--danger)" : "transparent",
              }}
            />
            <span style={{ fontSize: 14 }}>No replacement on hand — flag this for a manager to order</span>
          </button>

          {!noReplacement ? (
            <PhotoCaptureField
              label="Photo of the replacement item"
              preview={newItemPreview}
              onCapture={(f) => { setNewItemPhoto(f); setNewItemPreview(URL.createObjectURL(f)); }}
            />
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
              Managers will be notified that <strong>{specificItem.trim() || "this item"}</strong> needs to be ordered.
            </p>
          )}

          {error && <p className="error-text">{error}</p>}
          {justSubmitted && <p style={{ color: "var(--success)", fontSize: 13.5, margin: 0 }}>Logged ✓</p>}

          <button className="btn" onClick={tryOpenSign}>
            Continue to Sign
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Re-enter your PIN to sign</p>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>This confirms the restocking entry above.</p>
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
            <button onClick={() => { setSigning(false); setPin(""); }} style={{ fontSize: 13 }}>Cancel</button>
            <button onClick={() => pressDigit("0")} disabled={submitting}>0</button>
            <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={submitting}>⌫</button>
          </div>
          <button className="btn" style={{ marginTop: 12 }} disabled={pin.length < 4 || submitting} onClick={submit}>
            {submitting ? "Submitting…" : "Confirm"}
          </button>
        </div>
      )}

      <div className="section-label">Recent entries</div>
      {loadingLogs ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : logs.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No entries yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {logs.map((l) => (
            <div key={l.id} className="card" style={{ display: "flex", gap: 10 }}>
              {l.newItemPhotoUrl && (
                <img src={l.newItemPhotoUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {l.specificItem}
                    {l.noReplacement && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--danger)",
                          background: "var(--danger-soft)",
                          borderRadius: 999,
                          padding: "1px 8px",
                        }}
                      >
                        Needs ordering
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDateTime(l.createdAt)}</span>
                </div>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {l.employeeName ?? "Unknown"}
                  {l.roomRanOut ? ` · ran out: ${l.roomRanOut}` : ""}
                  {l.roomRestocked ? ` · restocked: ${l.roomRestocked}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
