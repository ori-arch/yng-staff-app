"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type ShellSession = {
  name: string;
  role: "front_desk" | "aesthetician" | "manager";
  isAdmin: boolean;
  isOwner: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  front_desk: "Front Desk",
  aesthetician: "Aesthetician",
  manager: "Manager",
};

type NavLink = { href: string; label: string };
type NavGroup = { label: string; links: NavLink[] };

function navFor(session: ShellSession): NavGroup[] {
  const isManager = session.role === "manager" || session.isAdmin;
  const isStaff = session.role === "aesthetician" || session.role === "front_desk";

  const groups: NavGroup[] = [];

  if (isStaff) {
    groups.push({
      label: "Your shift",
      links: [
        { href: "/checklists", label: "Open / Close Checklist" },
        ...(session.role === "aesthetician"
          ? [
              { href: "/equipment-log", label: "Equipment Log" },
              { href: "/inventory/room-restocking", label: "Room Restocking" },
            ]
          : [{ href: "/equipment-log", label: "Equipment Log" }]),
      ],
    });
    groups.push({
      label: "Facility duties",
      links: [
        { href: "/inventory/restock-runner", label: "Restock Runner" },
        { href: "/inventory/loft-cleaning", label: "Loft Cleaning" },
      ],
    });
  }

  groups.push({
    label: "Team",
    links: [
      { href: "/messages", label: "Messages" },
      { href: "/protocols", label: "Protocols" },
    ],
  });

  groups.push({
    label: "Requests",
    links: [
      { href: "/time-off", label: "Time Off" },
      { href: "/shift-swap", label: "Shift Swap" },
      { href: "/warnings", label: "Warnings" },
    ],
  });

  if (isManager) {
    groups.push({
      label: "Manage",
      links: [
        { href: "/compliance", label: "Compliance" },
        { href: "/photos", label: "Photos" },
        { href: "/equipment-log", label: "Equipment Log" },
        { href: "/inventory/room-restocking", label: "Room Restocking" },
        { href: "/inventory/restock-runner", label: "Restock Runner" },
        { href: "/inventory/loft-cleaning", label: "Loft Cleaning" },
        { href: "/admin", label: "Admin Panel" },
      ],
    });
  }

  return groups;
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function AppShell({ session, children }: { session: ShellSession | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Unauthenticated screens (who's-clocking-in, PIN entry, PIN setup) get a bare shell.
  const bare = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/setup");
  if (!session || bare) return <>{children}</>;

  const isHome = pathname === "/dashboard";
  const groups = navFor(session);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="header-left">
            {!isHome && (
              <button className="icon-btn" aria-label="Back" onClick={goBack}>
                <BackIcon />
              </button>
            )}
            <a href="/dashboard" className="logo-link" aria-label="Home">
              <img src="/logo-black.png" alt="yng." className="logo-img" />
            </a>
          </div>
          <div className="header-right">
            <button className="icon-btn" aria-label="Menu" onClick={() => setOpen(true)}>
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>

      {children}

      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} />
          <nav className="drawer" aria-label="Menu">
            <div className="drawer-head">
              <div className="drawer-who">
                <span className="name">{session.name}</span>
                <span className="role">
                  {ROLE_LABEL[session.role] ?? session.role}
                  {session.isOwner ? " · Owner" : session.isAdmin ? " · Admin" : ""}
                </span>
              </div>
              <button className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="drawer-group">
              <a href="/dashboard" className={`drawer-link${isHome ? " active" : ""}`}>
                Home <span className="chev">›</span>
              </a>
            </div>

            {groups.map((g) => (
              <div className="drawer-group" key={g.label}>
                <div className="drawer-group-label">{g.label}</div>
                {g.links.map((l) => {
                  const active = pathname === l.href || pathname.startsWith(l.href + "/");
                  return (
                    <a key={l.href} href={l.href} className={`drawer-link${active ? " active" : ""}`}>
                      {l.label} <span className="chev">›</span>
                    </a>
                  );
                })}
              </div>
            ))}

            <div className="drawer-foot">
              <button className="btn outline" onClick={logout}>
                Log out
              </button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
