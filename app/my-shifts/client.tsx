"use client";

import { useEffect, useMemo, useState } from "react";

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

type TimeOffBlock = { employeeId: string; employeeName: string; startDate: string; endDate: string; reason: string | null };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VIEWS = [
  { key: "list", label: "List" },
  { key: "calendar", label: "Calendar" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function fmtDay(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function gridRange(monthAnchor: Date) {
  const first = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), 1));
  const last = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(last);
  end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7));
  return { start, end };
}

export default function MyShifts() {
  const [view, setView] = useState<ViewKey>("list");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="container">
      <h1 className="page-title">My Shifts</h1>
      <p className="page-sub">Your upcoming schedule.</p>

      <div className="tabs">
        {VIEWS.map((v) => (
          <button key={v.key} className={view === v.key ? "active" : ""} onClick={() => setView(v.key)}>
            {v.label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {view === "list" ? <ListView onError={setError} /> : <CalendarView onError={setError} />}
    </div>
  );
}

function ListView({ onError }: { onError: (e: string | null) => void }) {
  const [shifts, setShifts] = useState<ShiftInstance[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = toDateStr(new Date());
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() + 30);
    const end = toDateStr(endDate);
    fetch(`/api/schedule?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) onError(d.error);
        else {
          setShifts(d.shifts ?? []);
          setTimeOff(d.timeOff ?? []);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 14 }}>Loading…</p>;

  if (shifts.length === 0 && timeOff.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 14 }}>No shifts scheduled in the next 30 days.</p>;
  }

  const byDate = new Map<string, { shifts: ShiftInstance[]; off: TimeOffBlock[] }>();
  for (const s of shifts) {
    const entry = byDate.get(s.date) ?? { shifts: [], off: [] };
    entry.shifts.push(s);
    byDate.set(s.date, entry);
  }
  for (const t of timeOff) {
    let cur = new Date(t.startDate + "T00:00:00Z");
    const end = new Date(t.endDate + "T00:00:00Z");
    while (cur <= end) {
      const ds = toDateStr(cur);
      const entry = byDate.get(ds) ?? { shifts: [], off: [] };
      entry.off.push(t);
      byDate.set(ds, entry);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  const dates = Array.from(byDate.keys()).sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
      {dates.map((date) => {
        const entry = byDate.get(date)!;
        return (
          <div key={date} className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{fmtDay(date)}</div>
            {entry.shifts.map((s, i) => (
              <div key={i} style={{ fontSize: 14 }}>
                {s.startTime}–{s.endTime}
                {s.roomName ? ` · ${s.roomName}` : ""}
                {s.source === "exception" && s.note ? ` — ${s.note}` : ""}
              </div>
            ))}
            {entry.off.map((t, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--danger)" }}>
                Approved time off{t.reason ? ` — ${t.reason}` : ""}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ onError }: { onError: (e: string | null) => void }) {
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)));
  const [shifts, setShifts] = useState<ShiftInstance[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const { start, end } = useMemo(() => gridRange(monthAnchor), [monthAnchor]);
  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/schedule?start=${startStr}&end=${endStr}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) onError(d.error);
        else {
          setShifts(d.shifts ?? []);
          setTimeOff(d.timeOff ?? []);
        }
      })
      .finally(() => setLoading(false));
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
        <strong>{monthLabel(monthAnchor)}</strong>
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
          {WEEKDAY_LABELS.map((w) => (
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
                onClick={() => setSelected(date === selected ? null : date)}
                style={{
                  textAlign: "left",
                  minHeight: 56,
                  padding: 4,
                  borderRadius: 8,
                  border: date === todayStr ? "1.5px solid var(--gold)" : selected === date ? "1.5px solid var(--ink)" : "1px solid var(--border)",
                  background: inMonth ? "#fff" : "var(--surface)",
                  opacity: inMonth ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{Number(date.slice(8))}</span>
                {dayShifts.length > 0 && (
                  <div style={{ fontSize: 9.5, marginTop: 2, background: "var(--gold-soft)", color: "var(--gold-dark)", borderRadius: 4, padding: "1px 3px" }}>
                    {dayShifts[0].startTime}
                  </div>
                )}
                {dayOff.length > 0 && <div style={{ fontSize: 9.5, color: "var(--danger)", marginTop: 2 }}>Off</div>}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{fmtDay(selected)}</div>
          {(shiftsByDate.get(selected) ?? []).length === 0 && offOnDate(selected).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>Nothing scheduled.</p>
          ) : (
            <>
              {(shiftsByDate.get(selected) ?? []).map((s, i) => (
                <div key={i} style={{ fontSize: 14 }}>
                  {s.startTime}–{s.endTime}
                  {s.roomName ? ` · ${s.roomName}` : ""}
                  {s.note ? ` — ${s.note}` : ""}
                </div>
              ))}
              {offOnDate(selected).map((t, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--danger)" }}>
                  Approved time off{t.reason ? ` — ${t.reason}` : ""}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
