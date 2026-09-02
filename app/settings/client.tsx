"use client";

import { useEffect, useState } from "react";
import {
  disablePushNotifications,
  enablePushNotifications,
  hasPushSubscription,
  pushSupported,
} from "@/lib/push-client";

export default function Settings({
  name,
  roleLabel,
  isOwner,
  isAdmin,
}: {
  name: string;
  roleLabel: string;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "off" | "on" | "busy">("unknown");

  useEffect(() => {
    if (!pushSupported()) setPushState("unsupported");
    else hasPushSubscription().then((has) => setPushState(has ? "on" : "off"));
  }, []);

  async function toggle() {
    setPushState("busy");
    if (pushState === "on") {
      await disablePushNotifications();
      setPushState("off");
    } else {
      const ok = await enablePushNotifications();
      setPushState(ok ? "on" : "off");
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Your account and notification preferences.</p>

      <div className="section-label">Account</div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
          {roleLabel}
          {isOwner ? " · Owner" : isAdmin ? " · Admin" : ""}
        </div>
      </div>

      <div className="section-label">Notifications</div>
      <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Push notifications on this device</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            {pushState === "unsupported"
              ? "Not supported in this browser."
              : pushState === "on"
                ? "On — you'll get alerts here even when the app isn't open."
                : "Off — you'll only see new items when you open the app."}
          </div>
        </div>
        {pushState !== "unsupported" && (
          <button
            className={pushState === "on" ? "btn outline" : "btn"}
            style={{ width: "auto", padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" }}
            onClick={toggle}
            disabled={pushState === "busy" || pushState === "unknown"}
          >
            {pushState === "busy" ? "…" : pushState === "on" ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
        On iPhone, this only works after installing the app to your home screen from Safari&apos;s Share menu — push
        notifications don&apos;t work from a regular Safari tab.
      </p>
    </div>
  );
}
