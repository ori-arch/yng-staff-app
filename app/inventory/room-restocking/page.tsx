"use client";

import { useEffect, useRef, useState } from "react";

type Room = { id: string; name: string };

type Log = {
  id: string;
  itemType: string | null;
  specificItem: string;
  remainingQuantity: string | null;
  emptyBottlePhotoUrl: string | null;
  newItemPhotoUrl: string | null;
  createdAt: string;
  employeeName: string | null;
  roomRanOut: string | null;
  roomRestocked: string | null;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function PhotoField({
  label,
  file,
  preview,
  onChoose,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onChoose: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onChoose(f);
        }}
      />
      {preview ? (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <img src={preview} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
          <button onClick={() => ref.current?.click()} style={{ fontSize: 13 }}>Retake</button>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px dashed #999" }}
        >
          Take photo
        </button>
      )}
    </div>
  );
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
    setNewItemPhoto(null);
    setNewItemPreview(null);
    setSigning(false);
    setPin("");
  }

  function tryOpenSign() {
    setError(null);
    if (!specificItem.trim()) {
      setError("Enter which item was restocked.");
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
    if (!newItemPhoto) {
      setError("A photo of the replacement item is required.");
      return;
    }
    setSigning(true);
  }

  function pressDigit(d: string) {
    setError(null);
    setPin((p) => (p + d).slice(0, 6));
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
      <div className="top-bar">
        <a href="/dashboard" className="link-button">← Dashboard</a>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Room Restocking Log</h1>
      <p style={{ color: "#6b6b6b", fontSize: 14 }}>Log a pulled item and its replacement.</p>

      {!signing ? (
        <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Item type (optional)</label>
            <input
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              placeholder="e.g. Backbar, Retail"
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ddd" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Specific item</label>
            <input
              value={specificItem}
              onChange={(e) => setSpecificItem(e.target.value)}
              placeholder="e.g. Witch hazel"
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ddd" }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Room ran out</label>
              <select
                value={roomRanOutId}
                onChange={(e) => setRoomRanOutId(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ddd" }}
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
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ddd" }}
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
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ddd" }}
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
                  <span style={{ width: 18, height: 18, minWidth: 18, borderRadius: 5, border: "2px solid #1a1a1a", background: c.val ? "#1a1a1a" : "transparent" }} />
                  <span style={{ fontSize: 14 }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <PhotoField label="Photo of the empty bottle (before disposal)" file={emptyBottlePhoto} preview={emptyBottlePreview} onChoose={(f) => { setEmptyBottlePhoto(f); setEmptyBottlePreview(URL.createObjectURL(f)); }} />
          <PhotoField label="Photo of the replacement item" file={newItemPhoto} preview={newItemPreview} onChoose={(f) => { setNewItemPhoto(f); setNewItemPreview(URL.createObjectURL(f)); }} />

          {error && <p className="error-text">{error}</p>}
          {justSubmitted && <p style={{ color: "#1a7a3a", fontSize: 13.5, margin: 0 }}>Logged ✓</p>}

          <button className="primary" onClick={tryOpenSign}>
            Continue to Sign
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Re-enter your PIN to sign</p>
          <p style={{ fontSize: 12.5, color: "#6b6b6b", marginTop: 0 }}>This confirms the restocking entry above.</p>
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
          <button className="primary" style={{ marginTop: 12 }} disabled={pin.length < 4 || submitting} onClick={submit}>
            {submitting ? "Submitting…" : "Confirm"}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 24 }}>Recent entries</h2>
      {loadingLogs ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>Loading…</p>
      ) : logs.length === 0 ? (
        <p style={{ color: "#6b6b6b", fontSize: 14 }}>No entries yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {logs.map((l) => (
            <div key={l.id} className="card" style={{ display: "flex", gap: 10 }}>
              {l.newItemPhotoUrl && (
                <img src={l.newItemPhotoUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{l.specificItem}</span>
                  <span style={{ fontSize: 12, color: "#6b6b6b" }}>{fmtDateTime(l.createdAt)}</span>
                </div>
                <span style={{ fontSize: 12.5, color: "#6b6b6b" }}>
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
