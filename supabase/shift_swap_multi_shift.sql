-- ========== Shift Swap: multiple shifts + partial acceptance (2026-09-04) ==========
--
-- A swap request used to carry exactly one shift (shift_date/start_time/
-- end_time/room_id directly on shift_swap_requests). Ori asked for the
-- requester to be able to offer several shifts to one coworker in a single
-- request, and for the coworker to be able to accept only some of them --
-- so each shift now lives in its own row, with its own acceptance state,
-- under the parent request.
--
-- The old columns on shift_swap_requests are left in place (already
-- nullable) for any pre-existing rows; new requests no longer populate them
-- and read paths use shift_swap_request_shifts instead.

create table shift_swap_request_shifts (
  id uuid primary key default gen_random_uuid(),
  swap_request_id uuid not null references shift_swap_requests(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  room_id uuid references rooms(id),
  -- null = not yet decided, true = coworker accepted this one, false = coworker declined/left it out
  accepted boolean,
  -- true once a manager has approved this specific shift and moved it onto the real schedule
  owner_approved boolean not null default false,
  -- set when this shift has been re-offered to a different coworker in a follow-up request,
  -- so the original card can show "re-offered to X" instead of a dead end.
  reoffered_swap_request_id uuid references shift_swap_requests(id),
  created_at timestamptz not null default now()
);

create index shift_swap_request_shifts_request_idx on shift_swap_request_shifts (swap_request_id);
