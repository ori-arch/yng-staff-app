"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  title?: string;
  onCapture: (file: File) => void;
  onCancel: () => void;
};

type Status = "loading" | "ready" | "error";

/**
 * Full-screen live camera capture using getUserMedia + a canvas snapshot —
 * used everywhere the app needs a "prove you took this photo right now"
 * shot (checklist photos, equipment log, room restocking). Deliberately does
 * NOT fall back to a plain <input type="file"> gallery picker: if the
 * camera can't be opened, it shows a clear reason and a retry button
 * instead of silently letting someone upload an old photo.
 */
export default function CameraCapture({ title, onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [canFlip, setCanFlip] = useState(false);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start(mode: "environment" | "user") {
    setStatus("loading");
    setErrorMsg(null);
    stopStream();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("unsupported"), { name: "UnsupportedError" });
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus("ready");
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch {
        // enumerateDevices can fail quietly on some browsers — flip button just won't show.
      }
    } catch (err: unknown) {
      setStatus("error");
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setErrorMsg("Camera access was blocked. Allow camera access for this site in your browser or phone settings, then try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setErrorMsg("No camera was found on this device. Open this page on a phone to take the photo.");
      } else if (name === "UnsupportedError") {
        setErrorMsg("This browser doesn't support camera capture here. Try the built-in browser on your phone (Safari or Chrome) over a secure connection.");
      } else {
        setErrorMsg("Couldn't open the camera. Check that no other app is using it, then try again.");
      }
    }
  }

  useEffect(() => {
    start(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flip() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    start(next);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopStream();
        onCapture(file);
      },
      "image/jpeg",
      0.85
    );
  }

  function cancel() {
    stopStream();
    onCancel();
  }

  return (
    <div className="camera-overlay">
      <div className="camera-topbar">
        <button className="camera-icon-btn" onClick={cancel} aria-label="Cancel">
          ✕
        </button>
        <span className="camera-title">{title ?? "Take Photo"}</span>
        {canFlip && status === "ready" ? (
          <button className="camera-icon-btn" onClick={flip} aria-label="Flip camera">
            ⟲
          </button>
        ) : (
          <span style={{ width: 40 }} />
        )}
      </div>

      <div className="camera-stage">
        {status === "error" ? (
          <div className="camera-error">
            <p>{errorMsg}</p>
            <button className="btn gold" onClick={() => start(facing)}>
              Try Again
            </button>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted className="camera-video" />
        )}
        {status === "loading" && <p className="camera-loading">Opening camera…</p>}
      </div>

      {status === "ready" && (
        <div className="camera-controls">
          <button className="camera-shutter" onClick={capture} aria-label="Take photo" />
        </div>
      )}
    </div>
  );
}
