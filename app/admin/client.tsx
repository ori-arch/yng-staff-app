"use client";

import { useEffect, useState } from "react";

type Employee = {
  id: string;
  name: string;
  role: "front_desk" | "aesthetician" | "manager";
  is_admin: boolean;
  is_owner: boolean;
  active: boolean;
};

type Room = { id: string; name: string; active: boolean };

type Template = {
  id: string;
  role: "front_desk" | "aesthetician";
  segment: "open" | "close";
  item_order: number;
  item_text: string;
  requires_photo: boolean;
  first_shift_only: boolean;
  last_shift_only: boolean;
  active: boolean;
};

type BackbarItem = {
  id: string;
  name: string;
  unit: string | null;
  par_level: number;
  current_quantity: number;
  active: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  front_desk: "Front Desk",
  aesthetician: "Aesthetician",
  manager: "Manager",
};

const TABS = [
  { key: "employees", label: "Employees" },
  { key: "rooms", label: "Rooms" },
  { key: "checklists", label: "Checklists" },
  { key: "parLevels", label: "Par Levels" },
  { key: "broadcastTemplates", label: "Broadcast Templates" },
  { key: "conductPolicy", label: "Conduct Policy" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function inputStyle(extra?: object) {
  return { padding: "11px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 14.5, ...extra };
}

export default function Admin({ isOwner, myEmployeeId }: { isOwner: boolean; myEmployeeId: string }) {
  const [tab, setTab] = useState<TabKey>("employees");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="container">
      <h1 className="page-title">Admin Panel</h1>
      <p className="page-sub">Manage employees, rooms, checklists, and par levels.</p>

      {error && <p className="error-text">{error}</p>}

      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employees" && <EmployeesTab isOwner={isOwner} myEmployeeId={myEmployeeId} setError={setError} />}
      {tab === "rooms" && <RoomsTab setError={setError} />}
      {tab === "checklists" && <ChecklistsTab setError={setError} />}
      {tab === "parLevels" && <ParLevelsTab setError={setError} />}
      {tab === "broadcastTemplates" && <BroadcastTemplatesTab setError={setError} />}
      {tab === "conductPolicy" && <ConductPolicyTab setError={setError} />}
    </div>
  );
}

/* ---------------- Employees ---------------- */

function EmployeesTab({
  isOwner,
  myEmployeeId,
  setError,
}: {
  isOwner: boolean;
  myEmployeeId: string;
  setError: (e: string | null) => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("aesthetician");
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [justSet, setJustSet] = useState<{ id: string; pin: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/employees")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setEmployees(data.employees ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addEmployee() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        load();
      } else setError(data.error || "Could not add employee.");
    } finally {
      setAdding(false);
    }
  }

  async function update(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update employee.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitReset(id: string, name: string) {
    if (!resetPin || resetPin.length < 4) {
      setResetError("PIN must be at least 4 digits.");
      return;
    }
    setBusyId(id);
    setResetError(null);
    try {
      const res = await fetch("/api/auth/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, newPin: resetPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setJustSet({ id, pin: resetPin, name });
        setResetFor(null);
        setResetPin("");
      } else setResetError(data.error || "Could not set PIN.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Add employee</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...inputStyle(), flex: 2, minWidth: 120 }}
          />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ ...inputStyle(), flex: 1 }}>
            <option value="front_desk">Front Desk</option>
            <option value="aesthetician">Aesthetician</option>
            <option value="manager">Manager</option>
          </select>
          <button className="btn" disabled={!newName.trim() || adding} onClick={addEmployee}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 0" }}>
          New employees start with no PIN — they'll set one themselves the first time they tap their name and hit
          "Forgot?".
        </p>
      </div>

      <div className="section-label">Employees</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {employees.map((e) => (
          <div key={e.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {e.name}
                {e.is_owner && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}> · Owner</span>}
                {e.is_admin && !e.is_owner && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}> · Admin</span>}
                {!e.active && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 400 }}> · Inactive</span>}
              </span>
              <select
                value={e.role}
                disabled={busyId === e.id || e.is_owner}
                onChange={(ev) => update(e.id, { role: ev.target.value })}
                style={inputStyle({ padding: "4px 6px" })}
              >
                <option value="front_desk">Front Desk</option>
                <option value="aesthetician">Aesthetician</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {!e.is_owner && (
                <button
                  disabled={busyId === e.id}
                  onClick={() => update(e.id, { active: !e.active })}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                >
                  {e.active ? "Deactivate" : "Reactivate"}
                </button>
              )}
              {isOwner && !e.is_owner && (
                <button
                  disabled={busyId === e.id}
                  onClick={() => update(e.id, { isAdmin: !e.is_admin })}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                >
                  {e.is_admin ? "Revoke Admin" : "Make Admin"}
                </button>
              )}
              {e.id !== myEmployeeId && (
                <button
                  onClick={() => {
                    const opening = resetFor !== e.id;
                    setResetFor(opening ? e.id : null);
                    setResetPin("");
                    setResetError(null);
                    if (opening) setJustSet(null);
                  }}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                >
                  Set PIN
                </button>
              )}
            </div>

            {resetFor === e.id && (
              <div className="card tinted" style={{ marginTop: 10, padding: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  New PIN for {e.name} (4–6 digits)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    placeholder="e.g. 4821"
                    value={resetPin}
                    onChange={(ev) => setResetPin(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{
                      flex: 1,
                      fontSize: 22,
                      letterSpacing: "0.3em",
                      textAlign: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border-strong)",
                    }}
                  />
                  <button
                    className="btn"
                    style={{ width: "auto", padding: "0 16px" }}
                    disabled={busyId === e.id || resetPin.length < 4}
                    onClick={() => submitReset(e.id, e.name)}
                  >
                    {busyId === e.id ? "Saving…" : "Save"}
                  </button>
                </div>
                {resetError && <p className="error-text" style={{ margin: "8px 0 0" }}>{resetError}</p>}
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 0" }}>
                  {e.name} can log in with this PIN right away — it replaces her old one immediately.
                </p>
              </div>
            )}

            {justSet?.id === e.id && (
              <div className="card gold" style={{ marginTop: 10, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 13.5 }}>
                  ✓ PIN set to <strong style={{ fontSize: 17, letterSpacing: "0.1em" }}>{justSet.pin}</strong> for {justSet.name}.
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
                  Share this with her now — it won't be shown again.
                </p>
                <button className="link-button" style={{ padding: 0, marginTop: 4 }} onClick={() => setJustSet(null)}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Rooms ---------------- */

function RoomsTab({ setError }: { setError: (e: string | null) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function load() {
    fetch("/api/admin/rooms")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRooms(data.rooms ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRoom() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        load();
      } else setError(data.error || "Could not add room.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update room.");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(r: Room) {
    setEditingId(r.id);
    setEditName(r.name);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditingId(null);
        load();
      } else setError(data.error || "Could not rename room.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Add room</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Room name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...inputStyle(), flex: 1 }}
          />
          <button className="btn" style={{ width: "auto", padding: "0 16px" }} disabled={!newName.trim() || adding} onClick={addRoom}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="section-label">Rooms</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rooms.map((r) => (
          <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            {editingId === r.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...inputStyle(), flex: 1 }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    disabled={busyId === r.id || !editName.trim()}
                    onClick={() => saveEdit(r.id)}
                    className="btn"
                    style={{ padding: "6px 10px", width: "auto" }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14 }}>
                  {r.name}
                  {!r.active && <span style={{ fontSize: 11, color: "var(--danger)" }}> · Inactive</span>}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => startEdit(r)}
                    style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => toggleActive(r.id, r.active)}
                    style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                  >
                    {r.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Checklists ---------------- */

const GROUPS: { role: "front_desk" | "aesthetician"; segment: "open" | "close"; label: string }[] = [
  { role: "front_desk", segment: "open", label: "Front Desk — Open" },
  { role: "front_desk", segment: "close", label: "Front Desk — Close" },
  { role: "aesthetician", segment: "open", label: "Aesthetician — Open" },
  { role: "aesthetician", segment: "close", label: "Aesthetician — Close" },
];

function ChecklistsTab({ setError }: { setError: (e: string | null) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newText, setNewText] = useState<Record<string, string>>({});
  const [newPhoto, setNewPhoto] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function load() {
    fetch("/api/admin/checklist-templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTemplates(data.templates ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(id: string, field: string, value: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/checklist-templates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update item.");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(t: Template) {
    setEditingId(t.id);
    setEditText(t.item_text);
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/checklist-templates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemText: editText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditingId(null);
        load();
      } else setError(data.error || "Could not save changes.");
    } finally {
      setBusyId(null);
    }
  }

  async function move(items: Template[], index: number, direction: -1 | 1) {
    const other = items[index + direction];
    const current = items[index];
    if (!other || !current) return;
    setBusyId(current.id);
    setError(null);
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/admin/checklist-templates/${current.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemOrder: other.item_order }),
        }),
        fetch(`/api/admin/checklist-templates/${other.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemOrder: current.item_order }),
        }),
      ]);
      if (!res1.ok || !res2.ok) {
        setError("Could not reorder items.");
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function addItem(role: string, segment: string) {
    const key = `${role}:${segment}`;
    const text = newText[key];
    if (!text || !text.trim()) return;
    setAdding(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/checklist-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, segment, itemText: text.trim(), requiresPhoto: !!newPhoto[key] }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewText((s) => ({ ...s, [key]: "" }));
        setNewPhoto((s) => ({ ...s, [key]: false }));
        load();
      } else setError(data.error || "Could not add item.");
    } finally {
      setAdding(null);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      {GROUPS.map((g) => {
        const key = `${g.role}:${g.segment}`;
        const items = templates.filter((t) => t.role === g.role && t.segment === g.segment);
        const isCollapsed = collapsed.has(key);
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <button
              onClick={() => toggleCollapsed(key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                background: "none",
                border: "none",
                padding: "8px 2px",
                cursor: "pointer",
              }}
            >
              <span className="section-label" style={{ margin: 0 }}>
                {g.label} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({items.length})</span>
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{isCollapsed ? "Show" : "Hide"}</span>
            </button>
            {!isCollapsed && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((t, i) => (
                    <div key={t.id} className="card" style={{ opacity: t.active ? 1 : 0.55 }}>
                      {editingId === t.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            style={{ ...inputStyle(), flex: 1 }}
                            autoFocus
                          />
                          <button
                            className="btn"
                            style={{ padding: "6px 10px", width: "auto" }}
                            disabled={busyId === t.id || !editText.trim()}
                            onClick={() => saveEdit(t.id)}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <p style={{ margin: 0, fontSize: 13.5 }}>{t.item_text}</p>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button
                              disabled={busyId === t.id || i === 0}
                              onClick={() => move(items, i, -1)}
                              title="Move up"
                              style={{ fontSize: 12, padding: "2px 7px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                            >
                              ^
                            </button>
                            <button
                              disabled={busyId === t.id || i === items.length - 1}
                              onClick={() => move(items, i, 1)}
                              title="Move down"
                              style={{ fontSize: 12, padding: "2px 7px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                            >
                              v
                            </button>
                            <button
                              disabled={busyId === t.id}
                              onClick={() => startEdit(t)}
                              style={{ fontSize: 11.5, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={t.requires_photo}
                            disabled={busyId === t.id}
                            onChange={(e) => toggle(t.id, "requiresPhoto", e.target.checked)}
                          />
                          Requires photo
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={t.first_shift_only}
                            disabled={busyId === t.id}
                            onChange={(e) => toggle(t.id, "firstShiftOnly", e.target.checked)}
                          />
                          First shift only
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={t.last_shift_only}
                            disabled={busyId === t.id}
                            onChange={(e) => toggle(t.id, "lastShiftOnly", e.target.checked)}
                          />
                          Last shift only
                        </label>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => toggle(t.id, "active", !t.active)}
                          style={{ fontSize: 11.5, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                        >
                          {t.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="New item text"
                    value={newText[key] || ""}
                    onChange={(e) => setNewText((s) => ({ ...s, [key]: e.target.value }))}
                    style={{ ...inputStyle(), flex: 1 }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!newPhoto[key]}
                      onChange={(e) => setNewPhoto((s) => ({ ...s, [key]: e.target.checked }))}
                    />
                    Photo
                  </label>
                  <button
                    className="btn"
                    style={{ padding: "6px 10px", width: "auto" }}
                    disabled={!newText[key]?.trim() || adding === key}
                    onClick={() => addItem(g.role, g.segment)}
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Par Levels ---------------- */

function ParLevelsTab({ setError }: { setError: (e: string | null) => void }) {
  const [items, setItems] = useState<BackbarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { par: string; qty: string }>>({});

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPar, setNewPar] = useState("");
  const [newQty, setNewQty] = useState("");
  const [adding, setAdding] = useState(false);

  function load() {
    fetch("/api/admin/backbar-items")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setItems(data.items ?? []);
          const e: Record<string, { par: string; qty: string }> = {};
          (data.items ?? []).forEach((it: BackbarItem) => {
            e[it.id] = { par: String(it.par_level), qty: String(it.current_quantity) };
          });
          setEdits(e);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addItem() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backbar-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), unit: newUnit, parLevel: newPar, currentQuantity: newQty }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setNewUnit("");
        setNewPar("");
        setNewQty("");
        load();
      } else setError(data.error || "Could not add item.");
    } finally {
      setAdding(false);
    }
  }

  async function save(id: string) {
    const e = edits[id];
    if (!e) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/backbar-items/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parLevel: e.par, currentQuantity: e.qty }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not save.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/backbar-items/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update item.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Add backbar item</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...inputStyle(), flex: 2, minWidth: 100 }} />
          <input type="text" placeholder="Unit (e.g. bottle)" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ ...inputStyle(), flex: 1, minWidth: 90 }} />
          <input type="number" placeholder="Par level" value={newPar} onChange={(e) => setNewPar(e.target.value)} style={{ ...inputStyle(), width: 90 }} />
          <input type="number" placeholder="Current qty" value={newQty} onChange={(e) => setNewQty(e.target.value)} style={{ ...inputStyle(), width: 90 }} />
          <button className="btn" disabled={!newName.trim() || adding} onClick={addItem}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="section-label">Backbar items &amp; par levels</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} className="card" style={{ opacity: it.active ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {it.name}
                {it.unit ? ` (${it.unit})` : ""}
                {!it.active && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 400 }}> · Inactive</span>}
              </span>
              <button
                disabled={busyId === it.id}
                onClick={() => toggleActive(it.id, it.active)}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
              >
                {it.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Par</label>
              <input
                type="number"
                value={edits[it.id]?.par ?? ""}
                onChange={(e) => setEdits((s) => ({ ...s, [it.id]: { ...s[it.id], par: e.target.value } }))}
                style={{ ...inputStyle(), width: 70 }}
              />
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Current</label>
              <input
                type="number"
                value={edits[it.id]?.qty ?? ""}
                onChange={(e) => setEdits((s) => ({ ...s, [it.id]: { ...s[it.id], qty: e.target.value } }))}
                style={{ ...inputStyle(), width: 70 }}
              />
              <button className="btn" style={{ padding: "6px 10px" }} disabled={busyId === it.id} onClick={() => save(it.id)}>
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Broadcast Templates ---------------- */

type BroadcastTemplate = { id: string; title: string; body: string; active: boolean };

function BroadcastTemplatesTab({ setError }: { setError: (e: string | null) => void }) {
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { title: string; body: string }>>({});

  function load() {
    fetch("/api/broadcast-templates?all=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTemplates(data.templates ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTemplate() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/broadcast-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewTitle("");
        setNewBody("");
        load();
      } else setError(data.error || "Could not add template.");
    } finally {
      setAdding(false);
    }
  }

  function edited(t: BroadcastTemplate) {
    return edits[t.id] ?? { title: t.title, body: t.body };
  }

  async function saveTemplate(t: BroadcastTemplate) {
    const e = edited(t);
    setBusyId(t.id);
    setError(null);
    try {
      const res = await fetch(`/api/broadcast-templates/${t.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: e.title, body: e.body }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not save template.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(t: BroadcastTemplate) {
    setBusyId(t.id);
    setError(null);
    try {
      const res = await fetch(`/api/broadcast-templates/${t.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      const data = await res.json();
      if (res.ok) load();
      else setError(data.error || "Could not update template.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>;

  return (
    <>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
        These show up as tappable quick-fill options on the <strong>Send a Broadcast</strong> screen.
      </p>

      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Add template</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="text"
            placeholder="Title (e.g. Early Closure)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={inputStyle()}
          />
          <textarea
            placeholder="The actual announcement text"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            style={{ ...inputStyle(), resize: "vertical" }}
          />
          <button className="btn" disabled={!newTitle.trim() || !newBody.trim() || adding} onClick={addTemplate} style={{ width: "auto" }}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      <div className="section-label">Templates</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {templates.map((t) => {
          const e = edited(t);
          return (
            <div key={t.id} className="card" style={{ opacity: t.active ? 1 : 0.55 }}>
              <input
                type="text"
                value={e.title}
                onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...e, title: ev.target.value } }))}
                style={{ ...inputStyle(), width: "100%", fontWeight: 600, marginBottom: 6 }}
              />
              <textarea
                value={e.body}
                onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...e, body: ev.target.value } }))}
                rows={2}
                style={{ ...inputStyle(), width: "100%", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn" style={{ width: "auto", padding: "6px 12px" }} disabled={busyId === t.id} onClick={() => saveTemplate(t)}>
                  Save
                </button>
                <button
                  disabled={busyId === t.id}
                  onClick={() => toggleActive(t)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                >
                  {t.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- Conduct Policy ---------------- */

type ViolationType = {
  id: string;
  key: string;
  name: string;
  track: "green" | "yellow" | "red";
  levelLabel: string;
  description: string;
  recommendedAction: string | null;
  strikeLimit: number;
  resetPeriod: "quarterly" | "annually" | "never";
  displayOrder: number;
  active: boolean;
};

const TRACK_META: Record<string, { emoji: string; label: string }> = {
  green: { emoji: "🟢", label: "Green" },
  yellow: { emoji: "🟡", label: "Yellow" },
  red: { emoji: "🔴", label: "Red" },
};

function ConductPolicyTab({ setError }: { setError: (e: string | null) => void }) {
  const [types, setTypes] = useState<ViolationType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<ViolationType>>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState({
    key: "",
    name: "",
    track: "green" as "green" | "yellow" | "red",
    levelLabel: "",
    description: "",
    recommendedAction: "",
    strikeLimit: "3",
    resetPeriod: "quarterly" as "quarterly" | "annually" | "never",
  });
  const [adding, setAdding] = useState(false);

  const [policyTitle, setPolicyTitle] = useState("");
  const [policyBody, setPolicyBody] = useState("");
  const [policyVersion, setPolicyVersion] = useState<number | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [confirmingPolicy, setConfirmingPolicy] = useState(false);

  function loadTypes() {
    fetch("/api/admin/violation-types?all=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTypes(data.violationTypes ?? []);
      })
      .finally(() => setLoadingTypes(false));
  }

  function loadPolicy() {
    fetch("/api/policy")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else if (data.policy) {
          setPolicyTitle(data.policy.title ?? "");
          setPolicyBody(data.policy.body ?? "");
          setPolicyVersion(data.policy.version ?? null);
        }
      })
      .finally(() => setLoadingPolicy(false));
  }

  useEffect(() => {
    loadTypes();
    loadPolicy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(t: ViolationType) {
    setExpandedId(t.id);
    setEdits((s) => ({
      ...s,
      [t.id]: {
        name: t.name,
        levelLabel: t.levelLabel,
        description: t.description,
        recommendedAction: t.recommendedAction ?? "",
        strikeLimit: t.strikeLimit,
        resetPeriod: t.resetPeriod,
        track: t.track,
      },
    }));
  }

  async function saveType(id: string) {
    const e = edits[id];
    if (!e) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/violation-types/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: e.name,
          levelLabel: e.levelLabel,
          description: e.description,
          recommendedAction: e.recommendedAction,
          strikeLimit: typeof e.strikeLimit === "string" ? parseInt(e.strikeLimit, 10) : e.strikeLimit,
          resetPeriod: e.resetPeriod,
          track: e.track,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setExpandedId(null);
        loadTypes();
      } else setError(data.error || "Could not save.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(t: ViolationType) {
    setBusyId(t.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/violation-types/${t.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      const data = await res.json();
      if (res.ok) loadTypes();
      else setError(data.error || "Could not update.");
    } finally {
      setBusyId(null);
    }
  }

  async function addType() {
    if (!newType.key.trim() || !newType.name.trim() || !newType.levelLabel.trim() || !newType.description.trim()) {
      setError("Key, name, level label and description are required.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/violation-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newType,
          strikeLimit: parseInt(newType.strikeLimit, 10) || 3,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewType({
          key: "",
          name: "",
          track: "green",
          levelLabel: "",
          description: "",
          recommendedAction: "",
          strikeLimit: "3",
          resetPeriod: "quarterly",
        });
        setShowAdd(false);
        loadTypes();
      } else setError(data.error || "Could not add violation type.");
    } finally {
      setAdding(false);
    }
  }

  async function savePolicy() {
    setSavingPolicy(true);
    setError(null);
    try {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: policyTitle, body: policyBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setPolicyVersion(data.version ?? null);
        setConfirmingPolicy(false);
      } else setError(data.error || "Could not save the policy.");
    } finally {
      setSavingPolicy(false);
    }
  }

  const grouped: Record<string, ViolationType[]> = { green: [], yellow: [], red: [] };
  types.forEach((t) => grouped[t.track]?.push(t));

  return (
    <>
      <div className="section-label">Violation types &amp; strike framework</div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4 }}>
        These drive the Green / Yellow / Red tracks staff see on the Conduct Policy page and when a warning is issued. Editing a type
        only changes what applies going forward — past warnings keep the details they were issued under.
      </p>

      {loadingTypes ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : (
        (["green", "yellow", "red"] as const).map((track) => (
          <div key={track} style={{ marginTop: 10 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>
              {TRACK_META[track].emoji} {TRACK_META[track].label} track
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {grouped[track].map((t) => {
                const e = edits[t.id] ?? {};
                const isOpen = expandedId === t.id;
                return (
                  <div key={t.id} className="card" style={{ opacity: t.active ? 1 : 0.55 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {t.name}
                        {!t.active && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 400 }}> · Inactive</span>}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => (isOpen ? setExpandedId(null) : startEdit(t))}
                          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                        >
                          {isOpen ? "Close" : "Edit"}
                        </button>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => toggleActive(t)}
                          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "white" }}
                        >
                          {t.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                      {t.levelLabel} · strike limit {t.strikeLimit} · resets {t.resetPeriod}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 13 }}>{t.description}</p>

                    {isOpen && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <input
                          placeholder="Name"
                          value={e.name ?? ""}
                          onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], name: ev.target.value } }))}
                          style={inputStyle()}
                        />
                        <select
                          value={e.track ?? t.track}
                          onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], track: ev.target.value as any } }))}
                          style={inputStyle()}
                        >
                          <option value="green">🟢 Green</option>
                          <option value="yellow">🟡 Yellow</option>
                          <option value="red">🔴 Red</option>
                        </select>
                        <input
                          placeholder="Level label (e.g. Level 1 — Coaching)"
                          value={e.levelLabel ?? ""}
                          onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], levelLabel: ev.target.value } }))}
                          style={inputStyle()}
                        />
                        <textarea
                          placeholder="Description"
                          value={e.description ?? ""}
                          onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], description: ev.target.value } }))}
                          rows={2}
                          style={{ ...inputStyle(), fontFamily: "inherit" }}
                        />
                        <textarea
                          placeholder="Recommended action (optional)"
                          value={e.recommendedAction ?? ""}
                          onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], recommendedAction: ev.target.value } }))}
                          rows={2}
                          style={{ ...inputStyle(), fontFamily: "inherit" }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <label style={{ fontSize: 12, color: "var(--muted)" }}>Strike limit</label>
                            <input
                              type="number"
                              value={e.strikeLimit ?? t.strikeLimit}
                              onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], strikeLimit: ev.target.value as any } }))}
                              style={{ ...inputStyle(), width: 70 }}
                            />
                          </div>
                          <select
                            value={e.resetPeriod ?? t.resetPeriod}
                            onChange={(ev) => setEdits((s) => ({ ...s, [t.id]: { ...s[t.id], resetPeriod: ev.target.value as any } }))}
                            style={inputStyle()}
                          >
                            <option value="quarterly">Resets quarterly</option>
                            <option value="annually">Resets annually</option>
                            <option value="never">Never resets</option>
                          </select>
                        </div>
                        <button className="btn gold" disabled={busyId === t.id} onClick={() => saveType(t.id)}>
                          {busyId === t.id ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {grouped[track].length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No violation types on this track yet.</p>}
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop: 12 }}>
        {!showAdd ? (
          <button className="btn outline sm" onClick={() => setShowAdd(true)}>
            Add a violation type
          </button>
        ) : (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>New violation type</p>
            <input
              placeholder="Key (e.g. late_arrival)"
              value={newType.key}
              onChange={(e) => setNewType((s) => ({ ...s, key: e.target.value }))}
              style={inputStyle()}
            />
            <input
              placeholder="Name (shown to staff)"
              value={newType.name}
              onChange={(e) => setNewType((s) => ({ ...s, name: e.target.value }))}
              style={inputStyle()}
            />
            <select value={newType.track} onChange={(e) => setNewType((s) => ({ ...s, track: e.target.value as any }))} style={inputStyle()}>
              <option value="green">🟢 Green</option>
              <option value="yellow">🟡 Yellow</option>
              <option value="red">🔴 Red</option>
            </select>
            <input
              placeholder="Level label"
              value={newType.levelLabel}
              onChange={(e) => setNewType((s) => ({ ...s, levelLabel: e.target.value }))}
              style={inputStyle()}
            />
            <textarea
              placeholder="Description"
              value={newType.description}
              onChange={(e) => setNewType((s) => ({ ...s, description: e.target.value }))}
              rows={2}
              style={{ ...inputStyle(), fontFamily: "inherit" }}
            />
            <textarea
              placeholder="Recommended action (optional)"
              value={newType.recommendedAction}
              onChange={(e) => setNewType((s) => ({ ...s, recommendedAction: e.target.value }))}
              rows={2}
              style={{ ...inputStyle(), fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                placeholder="Strike limit"
                value={newType.strikeLimit}
                onChange={(e) => setNewType((s) => ({ ...s, strikeLimit: e.target.value }))}
                style={{ ...inputStyle(), width: 100 }}
              />
              <select
                value={newType.resetPeriod}
                onChange={(e) => setNewType((s) => ({ ...s, resetPeriod: e.target.value as any }))}
                style={inputStyle()}
              >
                <option value="quarterly">Resets quarterly</option>
                <option value="annually">Resets annually</option>
                <option value="never">Never resets</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn gold" disabled={adding} onClick={addType}>
                {adding ? "Adding…" : "Add violation type"}
              </button>
              <button className="btn ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="section-label" style={{ marginTop: 20 }}>
        Conduct policy document
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: -4 }}>
        This is the text staff read and sign on {"/policy/sign"}. Saving a change bumps the version and requires every employee to
        re-read and re-sign it.
      </p>
      {loadingPolicy ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {policyVersion !== null && <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Current version: {policyVersion}</p>}
          <input placeholder="Title" value={policyTitle} onChange={(e) => setPolicyTitle(e.target.value)} style={inputStyle()} />
          <textarea
            placeholder="Policy body"
            value={policyBody}
            onChange={(e) => setPolicyBody(e.target.value)}
            rows={16}
            style={{ ...inputStyle(), fontFamily: "inherit", whiteSpace: "pre-wrap" }}
          />
          {!confirmingPolicy ? (
            <button className="btn outline sm" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmingPolicy(true)}>
              Save policy
            </button>
          ) : (
            <div className="card" style={{ background: "#fbf1dc" }}>
              <p style={{ fontSize: 13, margin: 0 }}>
                This will bump the policy to version {(policyVersion ?? 0) + 1} and require everyone to re-sign before using the app
                again. Continue?
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn gold" disabled={savingPolicy} onClick={savePolicy}>
                  {savingPolicy ? "Saving…" : "Yes, save and require re-signing"}
                </button>
                <button className="btn ghost" onClick={() => setConfirmingPolicy(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
