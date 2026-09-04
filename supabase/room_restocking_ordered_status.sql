-- ========== Room Restocking: track when a flagged item was ordered (2026-09-04) ==========
--
-- "no_replacement" flags a restocking entry as an order request. Without a
-- way to mark it handled, it would stay flagged forever and clutter the
-- manager dashboard's attention count. This adds a simple resolved-state so
-- a manager can mark "ordered" once it's taken care of.

alter table room_restocking_logs add column ordered boolean not null default false;
alter table room_restocking_logs add column ordered_by uuid references employees(id);
alter table room_restocking_logs add column ordered_at timestamptz;
