-- Adds room assignment to shifts (added 2026-09-02).
--
-- Aestheticians work out of a specific treatment room, and managers building
-- the schedule need to say which room a shift is in — both for the recurring
-- weekly patterns and for one-off exceptions layered on top. This is nullable
-- and optional: front desk shifts (and any shift that isn't room-specific)
-- can simply leave it blank.

alter table shift_patterns add column room_id uuid references rooms(id);
alter table shift_exceptions add column room_id uuid references rooms(id);
