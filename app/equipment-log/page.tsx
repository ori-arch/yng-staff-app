"use client";

import { useEffect, useState } from "react";
import PhotoCaptureField from "@/components/PhotoCaptureField";

type Log = {
  id: string;
  equipmentType: string;
  clientName: string | null;
  usedAt: string;
  receivedOperational: boolean | null;
  cleanedProperly: boolean | null;
  photoUrl: string | null;
  remarks: string | null;
  employeeName: string | null;
};

const DEVICE_OPTIONS = ["ReShape", "Microneedling Pen", "Fibroblast Pen", "Dermaplaning Tool", "Other"];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function EquipmentLogPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [equipmentType, setEquipmentType] = useState(DEVICE_OPTIONS[0]);
  const [customType, setCustomType] = useState("");
  const [clientName, setClientName] = useState("");
  const [receivedOperational, setReceivedOperational] = useState<boolean | null>(null);
  const [cleanedProperly, setCleanedProperly] = useState<boolean | null>(null);
  const [remarks, setRemarks] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  function loadLogs() {
    setLoadingLogs(true);
    fetch("/api/equipment-logs")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setLogs(data.logs ?? []);
      })
      .finally(() => setLoadingLogs(false));
  }

  useEffect(() => {
    loadLogs();
  }, []);

  function resetForm() {
    setEquipmentType(DEVICE_OPTIONS[0]);
    setCustomType("");
    setClientName("");
    setReceivedOperational(null);
    setCleanedProperly(null);
    setRemarks("");
    setPhoto(null);
    setPhotoPreview(null);
  }

  async function submit() {
    setError(null);
    const finalType = equipmentType === "Other" ? customType.trim() : equipmentType;
    if (!finalType) {
      setError("Enter the equipment type.");
      return;
    }
    if (receivedOperational === null) {
      setError("Confirm whether the device was received in operational condition.");
      return;
    }
    if (cleanedProperly === null) {
      setError("Confirm whether the tip/handpiece was cleaned and dried.");
      return;
    }
    if (!photo) {
      setError("A photo of the cleaned handpiece is required.");
      return;
    }

    setSubmitting(true);
    const form = new FormData();
    form.set("equipmentType", finalType);
    form.set("clientName", clientName);
    form.set("receivedOperational", String(receivedOperational));
    form.set("cleanedProperly", String(cleanedProperly));
    form.set("remarks", remarks);
    form.set("photo", photo);

    try {
      const res = await fetch("/api/equipment-logs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save this log.");
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
      <h1 className="page-title">Equipment Log</h1>
      <p className="page-sub">Log device use, cleaning, and condition checks.</p>

      <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Equipment</label>
          <select
            value={equipmentType}
            onChange={(e) => setEquipmentType(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
          >
            {DEVICE_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {equipmentType === "Other" && (
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Enter equipment name"
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid var(--border-strong)" }}
            />
          )}
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Client name (optional)</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)" }}
          />
        </div>

        <YesNoRow
          label="Received in operational condition?"
          value={receivedOperational}
          onChange={setReceivedOperational}
        />
        <YesNoRow
          label="Tip/handpiece cleaned and dried?"
          value={cleanedProperly}
          onChange={setCleanedProperly}
        />

        <PhotoCaptureField
          label="Photo of cleaned handpiece (required)"
          preview={photoPreview}
          cameraTitle="Cleaned Handpiece"
          onCapture={(f) => { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }}
        />

        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Remarks (optional)</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Anything unusual — noise, wear, damage, etc."
            rows={3}
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid var(--border-strong)", fontFamily: "inherit" }}
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {justSubmitted && <p style={{ color: "var(--success)", fontSize: 13.5, margin: 0 }}>Logged ✓</p>}

        <button className="btn" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Save Log"}
        </button>
      </div>

      <div className="section-label">Recent logs</div>
      {loadingLogs ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : logs.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No equipment logs yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {logs.map((l) => (
            <div key={l.id} className="card" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              {l.photoUrl && (
                <img src={l.photoUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{l.equipmentType}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDateTime(l.usedAt)}</span>
                </div>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {l.employeeName ?? "Unknown"}{l.clientName ? ` · ${l.clientName}` : ""}
                </span>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  {l.receivedOperational === false && <span style={{ color: "var(--danger)" }}>Not received operational. </span>}
                  {l.cleanedProperly === false && <span style={{ color: "var(--danger)" }}>Not cleaned properly. </span>}
                </div>
                {l.remarks && <p style={{ fontSize: 13, margin: "4px 0 0" }}>{l.remarks}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onChange(true)}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: value === true ? "2px solid var(--ink)" : "1px solid var(--border-strong)",
            background: value === true ? "var(--ink)" : "transparent",
            color: value === true ? "#fff" : "var(--ink)",
          }}
        >
          Yes
        </button>
        <button
          onClick={() => onChange(false)}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: value === false ? "2px solid var(--danger)" : "1px solid var(--border-strong)",
            background: value === false ? "var(--danger)" : "transparent",
            color: value === false ? "#fff" : "var(--ink)",
          }}
        >
          No
        </button>
      </div>
    </div>
  );
}
