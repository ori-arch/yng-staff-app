-- ========== Room Issue Reports ==========
--
-- "I started my shift and the room isn't ready" -- a quick photo + comment
-- report, not a compliance log, so no PIN signature is required (same as
-- the Equipment Log). Feeds a manager notification immediately and an
-- open/resolved list at /room-issues, and shows up in the existing Photos
-- gallery alongside checklist/equipment/room-restocking photos.

create table room_issue_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  room_id uuid references rooms(id),
  comment text not null,
  photo_url text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references employees(id),
  resolved_at timestamptz,
  resolved_note text,
  created_at timestamptz not null default now()
);

create index room_issue_reports_status_idx on room_issue_reports (status, created_at desc);
