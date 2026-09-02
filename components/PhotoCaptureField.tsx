"use client";

import { useState } from "react";
import CameraCapture from "./CameraCapture";

type Props = {
  label: string;
  preview: string | null;
  onCapture: (file: File) => void;
  cameraTitle?: string;
};

/** A labeled "Take photo" field backed by the live in-app camera (see CameraCapture) — used
 * for every audit-trail photo in the app (checklists, equipment log, room restocking). */
export default function PhotoCaptureField({ label, preview, onCapture, cameraTitle }: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
      {preview ? (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <img src={preview} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
          <button
            onClick={() => setCameraOpen(true)}
            style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "white" }}
          >
            Retake
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCameraOpen(true)}
          style={{
            width: "100%",
            marginTop: 6,
            padding: 13,
            borderRadius: 12,
            border: "1px dashed var(--gold)",
            background: "var(--gold-soft)",
            color: "var(--gold-dark)",
            fontWeight: 600,
            fontSize: 14.5,
            cursor: "pointer",
          }}
        >
          Take Photo
        </button>
      )}

      {cameraOpen && (
        <CameraCapture
          title={cameraTitle ?? label}
          onCancel={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            onCapture(file);
          }}
        />
      )}
    </div>
  );
}
