"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_MS = 60000;

/**
 * Every deploy to Vercel is a new build — this app has no offline/asset
 * service-worker cache, so a fresh page load always gets the latest code.
 * The gap is a tab or installed PWA someone leaves open (or just backgrounds
 * on their phone) across a deploy: it keeps running the JS it already
 * loaded until they fully reload. This polls /api/version, and the moment
 * the live deployment differs from the one this session loaded with, shows
 * a blocking "Update available" overlay — no dismiss, just Update Now,
 * which reloads to pick up the new version.
 */
export default function UpdateGate() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const myVersion = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function check() {
      fetch("/api/version")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled || !d.version) return;
          if (myVersion.current === null) {
            myVersion.current = d.version;
          } else if (d.version !== myVersion.current) {
            setNeedsUpdate(true);
          }
        })
        .catch(() => {});
    }

    check();
    const interval = setInterval(check, CHECK_MS);
    function onVisible() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!needsUpdate) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,17,17,0.6)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 22,
          maxWidth: 340,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Update available</div>
        <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 16px" }}>
          A new version of the app is ready. Update now to keep going.
        </p>
        <button className="btn gold" style={{ width: "100%" }} onClick={() => window.location.reload()}>
          Update Now
        </button>
      </div>
    </div>
  );
}
