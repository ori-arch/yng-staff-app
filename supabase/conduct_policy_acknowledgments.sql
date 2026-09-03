create table policy_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  policy_document_id uuid not null references policy_documents(id),
  version integer not null,
  signed_at timestamptz not null default now(),
  unique (employee_id, policy_document_id, version)
);

-- Extend Warning Notices to carry which violation type was selected, the
-- track it belonged to at issuance (snapshotted, same reasoning as
-- leaderboard points_awarded -- if a manager later reclassifies a type,
-- past warnings keep the track they were actually issued under), which
-- reset-window bucket it falls in, and which strike number it was within
-- that window. Also adds a soft-void so a manager can correct a mistaken
-- entry without erasing the audit trail, and edit tracking.
alter table warning_notices add column violation_type_id uuid references violation_types(id);
alter table warning_notices add column track text check (track in ('green', 'yellow', 'red'));
alter table warning_notices add column window_label text;
alter table warning_notices add column strike_number integer;
alter table warning_notices add column active boolean not null default true;
alter table warning_notices add column edited_by uuid references employees(id);
alter table warning_notices add column edited_at timestamptz;
alter table warning_notices alter column violation_description drop not null;
alter table warning_notices alter column violation_description drop default;
