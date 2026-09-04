-- ========== Bug Reports (2026-09-04) ==========
--
-- Any employee can flag something broken in the app. The owner gets
-- notified immediately and has a page listing every report, where she can
-- mark one fixed (or reopen it) as she works through them.

create table bug_reports (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid not null references employees(id),
  description text not null,
  page_path text,
  photo_url text,
  status text not null default 'open' check (status in ('open', 'fixed')),
  fixed_by uuid references employees(id),
  fixed_at timestamptz,
  fixed_note text,
  created_at timestamptz not null default now()
);

create index bug_reports_status_idx on bug_reports (status, created_at desc);
