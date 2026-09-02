"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = { id: string; name: string; role: string };

type Room = { id: string; name: string };

type ShiftInstance = {
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  source: "pattern" | "exception";
  note: string | null;
  roomId: string | null;
  roomName: string | null;
};

type TimeOffBlock = {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

type Pattern = {
  id: string;
  employeeId: string;
  employeeName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  note: string | null;
  active: boolean;
  roomId: string | null;
  roomName: string | null;
};

type Exception = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  action: "add" | "skip" | "modify";
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  roomId: string | null;
  roomName: string | null;
};

// Index-aligned with JS Date.getUTCDay() (0 = Sunday .. 6 = Saturday) — this
// is the convention shift_patterns.weekday is stored in, so keep this order
// for the Weekly Patterns dropdown even though the calendar displays Monday-first.
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Display-only order for the calendar grid header (week starts Monday).
const CALENDAR_HEADER_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Monday-first day picker for the "Add a recurring shift" form — value is the
// underlying weekday index (0 = Sunday .. 6 = Saturday) so it still matches
// what's stored in shift_patterns.weekday.
const WEEKDAY_OPTIONS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];
const TABS = [
  { key: "calendar", label: "Calendar" },
  { key: "patterns", label: "Weekly Patterns" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function inputStyle(extra?: object) {
  return { padding: 9, borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 13.5, ...extra };
}

/** Monday on/before `d`, and Sunday on/after `d`, for a full-week calendar grid. */
function gridRange(monthAnchor: Date): { start: Date; end: Date } {
  const first = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), 1));
  const last = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(last);
  end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7));
  return { start, end };
}

export default function Schedule() {
  const [tab, setTab] = useState<TabKey>("calendar");
  const [roster, setRoster] = useState<Employee[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/employees/roster")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setRoster(d.employees ?? []);
      });
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setRooms(d.rooms ?? []);
      });
  }, []);

  return (
    <div className="container">
      <h1 className="page-title">Schedule</h1>
      <p className="page-sub">Weekly recurring shifts, plus one-off changes for specific dates.</p>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {tab === "calendar" ? (
        <CalendarTab roster={roster} rooms={rooms} onError={setError} />
      ) : (
        <PatternsTab roster={roster} rooms={rooms} onError={setError} />
      )}
    </div>
  );
}

function CalendarTab({ roster, rooms, onError }: { roster: Employee[]; rooms: Room[]; onError: (e: string | null) => void }) {
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)));
  const [shifts, setShifts] = useState<ShiftInstance[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffBlock[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { start, end } = useMemo(() => gridRange(monthAnchor), [monthAnchor]);
  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/schedule?start=${startStr}&end=${endStr}`).then((r) => r.json()),
      fetch(`/api/admin/shift-exceptions?start=${startStr}&end=${endStr}`).then((r) => r.json()),
    ])
      .then(([sched, ex]) => {
        if (sched.error) onError(sched.error);
        else {
          setShifts(sched.shifts ?? []);
          setTimeOff(sched.timeOff ?? []);
        }
        if (!ex.error) setExceptions(ex.exceptions ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStr, endStr]);

  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(toDateStr(d));

  const shiftsByDate = new Map<string, ShiftInstance[]>();
  for (const s of shifts) {
    const arr = shiftsByDate.get(s.date) ?? [];
    arr.push(s);
    shiftsByDate.set(s.date, arr);
  }

  function isOff(date: string, employeeId: string) {
    return timeOff.some((t) => t.employeeId === employeeId && date >= t.startDate && date <= t.endDate);
  }
  const offOnDate = (date: string) => timeOff.filter((t) => date >= t.startDate && date <= t.endDate);

  const todayStr = toDateStr(new Date());

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <button
          className="btn outline"
          style={{ padding: "4px 10px", fontSize: 14, lineHeight: 1, width: "auto", minWidth: 0 }}
          onClick={() => setMonthAnchor((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)))}
        >
          ‹
        </button>
        <strong style={{ fontFamily: "var(--font-serif, serif)" }}>{monthLabel(monthAnchor)}</strong>
        <button
          className="btn outline"
          style={{ padding: "4px 10px", fontSize: 14, lineHeight: 1, width: "auto", minWidth: 0 }}
          onClick={() => setMonthAnchor((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)))}
        >
          ›
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12 }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 10 }}>
          {CALENDAR_HEADER_LABELS.map((w) => (
            <div key={w} style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", fontWeight: 700 }}>
              {w}
            </div>
          ))}
          {days.map((date) => {
            const dayShifts = shiftsByDate.get(date) ?? [];
            const dayOff = offOnDate(date);
            const inMonth = new Date(date + "T00:00:00Z").getUTCMonth() === monthAnchor.getUTCMonth();
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  textAlign: "left",
                  minHeight: 62,
                  padding: 4,
                  borderRadius: 8,
                  border: date === todayStr ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                  background: inMonth ? "#fff" : "var(--surface)",
                  opacity: inMonth ? 1 : 0.55,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{Number(date.slice(8))}</span>
                {dayShifts.slice(0, 2).map((s, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 9.5,
                      background: s.source === "exception" ? "var(--gold-soft)" : "var(--surface)",
                      color: s.source === "exception" ? "var(--gold-dark)" : "var(--ink)",
                      borderRadius: 4,
                      padding: "1px 3px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      opacity: isOff(date, s.employeeId) ? 0.4 : 1,
                    }}
                  >
                    {s.employeeName.split(" ")[0]} {s.startTime}
                  </span>
                ))}
                {dayShifts.length > 2 && (
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>+{dayShifts.length - 2} more</span>
                )}
                {dayOff.length > 0 && (
                  <span style={{ fontSize: 9.5, color: "var(--danger)" }}>
                    {dayOff.length === 1 ? `${dayOff[0].employeeName.split(" ")[0]} off` : `${dayOff.length} off`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedDate && (
        <DaySheet
          date={selectedDate}
          roster={roster}
          rooms={rooms}
          shifts={shiftsByDate.get(selectedDate) ?? []}
          timeOff={offOnDate(selectedDate)}
          exceptions={exceptions.filter((e) => e.date === selectedDate)}
          onClose={() => setSelectedDate(null)}
          onChanged={load}
          onError={onError}
        />
      )}
    </>
  );
}

function DaySheet({
  date,
  roster,
  rooms,
  shifts,
  timeOff,
  exceptions,
  onClose,
  onChanged,
  onError,
}: {
  date: string;
  roster: Employee[];
  rooms: Room[];
  shifts: ShiftInstance[];
  timeOff: TimeOffBlock[];
  exceptions: Exception[];
  onClose: () => void;
  onChanged: () => void;
  onError: (e: string | null) => void;
}) {
  const [employeeId, setEmployeeId] = useState(roster[0]?.id ?? "");
  const [action, setAction] = useState<"add" | "skip" | "modify">("add");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);

  const dateLabel = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  async function submit() {
    if (!employeeId) return;
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/admin/shift-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, action, startTime, endTime, note, roomId }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || "Could not save.");
        return;
      }
      setNote("");
      setRoomId("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function removeException(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shift-exceptions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(data.error || "Could not remove this exception.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <strong style={{ fontSize: 15 }}>{dateLabel}</strong>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {shifts.length === 0 && timeOff.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>Nothing scheduled.</p>
          )}
          {shifts.map((s, i) => (
            <div key={i} className="card" style={{ padding: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13.5 }}>
                {s.employeeName}
                {s.roomName ? <span style={{ color: "var(--muted)" }}> · {s.roomName}</span> : null}
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {s.startTime}–{s.endTime}
                {s.source === "exception" ? " (adjusted)" : ""}
              </span>
            </div>
          ))}
          {timeOff.map((t, i) => (
            <div key={i} className="card" style={{ padding: 8, background: "var(--danger-soft)" }}>
              <span style={{ fontSize: 13.5 }}>{t.employeeName} — approved time off</span>
              {t.reason && <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.reason}</div>}
            </div>
          ))}
        </div>

        {exceptions.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="section-label" style={{ marginTop: 0 }}>One-off changes today</div>
            {exceptions.map((ex) => (
              <div key={ex.id} className="card tinted" style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12.5 }}>
                  {ex.employeeName} — {ex.action}
                  {ex.action !== "skip" ? ` ${ex.startTime}–${ex.endTime}` : ""}
                  {ex.roomName ? ` · ${ex.roomName}` : ""}
                  {ex.note ? ` (${ex.note})` : ""}
                </span>
                <button onClick={() => removeException(ex.id)} disabled={busy} style={{ fontSize: 12, color: "var(--danger)" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="section-label" style={{ marginTop: 12 }}>Add a change for this date</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle()}>
            {roster.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value as typeof action)} style={inputStyle()}>
            <option value="add">Add an extra shift</option>
            <option value="modify">Change today's shift time</option>
            <option value="skip">Skip today's scheduled shift</option>
          </select>
          {action !== "skip" && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle({ flex: 1 })} />
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle({ flex: 1 })} />
              </div>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={inputStyle()}>
                <option value="">Room (optional)</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </>
          )}
          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle()} />
          <button className="btn" onClick={submit} disabled={busy || !employeeId}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} style={{ fontSize: 13, color: "var(--muted)" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternsTab({ roster, rooms, onError }: { roster: Employee[]; rooms: Room[]; onError: (e: string | null) => void }) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleWeekday(value: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function load() {
    fetch("/api/admin/shift-patterns")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) onError(d.error);
        else setPatterns(d.patterns ?? []);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!employeeId && roster.length > 0) setEmployeeId(roster[0].id);
  }, [roster, employeeId]);

  async function addPattern() {
    if (!employeeId || weekdays.size === 0) return;
    setBusy(true);
    onError(null);
    try {
      // One recurring pattern per selected day, same time/note on each.
      const results = await Promise.all(
        Array.from(weekdays).map((weekday) =>
          fetch("/api/admin/shift-patterns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId, weekday, startTime, endTime, note, roomId }),
          }).then(async (res) => ({ ok: res.ok, data: await res.json() }))
        )
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        onError(failed.data.error || "Could not save one or more days.");
        return;
      }
      setNote("");
      setRoomId("");
      setWeekdays(new Set());
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Pattern) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shift-patterns/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(data.error || "Could not update this pattern.");
        return;
      }
      load();
    } finally {
      setBusy(false);
    }
  }

  const selectedPatterns = patterns.filter((p) => p.employeeId === employeeId);

  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600 }}>Employee</label>
      <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ ...inputStyle(), width: "100%", marginTop: 4 }}>
        {roster.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>

      <div className="section-label">Recurring shifts</div>
      {selectedPatterns.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No recurring shifts set for this employee yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {selectedPatterns.map((p) => (
            <div key={p.id} className="card" style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: p.active ? 1 : 0.5 }}>
              <span style={{ fontSize: 13.5 }}>
                {WEEKDAY_LABELS[p.weekday]} · {p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)}
                {p.roomName ? ` · ${p.roomName}` : ""}
                {p.note ? ` — ${p.note}` : ""}
              </span>
              <button onClick={() => toggleActive(p)} disabled={busy} style={{ fontSize: 12.5, color: p.active ? "var(--danger)" : "var(--success)" }}>
                {p.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section-label">Add a recurring shift</div>
      <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Days (pick as many as apply)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {WEEKDAY_OPTIONS.map((d) => {
            const checked = weekdays.has(d.value);
            return (
              <label
                key={d.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 13,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: checked ? "1.5px solid var(--ink)" : "1px solid var(--border-strong)",
                  background: checked ? "var(--gold-soft)" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleWeekday(d.value)}
                  style={{ margin: 0 }}
                />
                {d.label}
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle({ flex: 1 })} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle({ flex: 1 })} />
        </div>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={inputStyle()}>
          <option value="">Room (optional)</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle()} />
        <button className="btn" onClick={addPattern} disabled={busy || !employeeId || weekdays.size === 0}>
          {busy ? "Saving…" : weekdays.size > 1 ? `Add recurring shift (${weekdays.size} days)` : "Add recurring shift"}
        </button>
      </div>
    </div>
  );
}
