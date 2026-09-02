-- Links shift swap requests to the real schedule (added 2026-09-02).
--
-- Shift Swap requests used to carry only a free-text "shift_description"
-- (e.g. "my Tuesday 9-5") with no link back to an actual shift_patterns /
-- shift_exceptions row. That meant an approved swap never actually changed
-- who the schedule says is working -- the Schedule calendar and My Shifts
-- had no idea a swap happened. This adds real shift details to the request
-- so that approving a swap can create the matching shift_exceptions rows
-- (skip the requester, add the coworker) and the calendar reflects reality.
--
-- shift_description is kept as an optional free-text note; it's no longer
-- required now that the actual date/time/room carry the real information.
-- Existing rows (if any) will have these new columns null -- those older
-- requests are treated as legacy/informational only and won't touch the
-- schedule when approved.

alter table shift_swap_requests add column shift_date date;
alter table shift_swap_requests add column start_time time;
alter table shift_swap_requests add column end_time time;
alter table shift_swap_requests add column room_id uuid references rooms(id);
alter table shift_swap_requests alter column shift_description drop not null;
