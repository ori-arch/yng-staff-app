-- ========== Widen notifications.type for manager approval alerts (2026-09-02) ==========
--
-- Adds "approval_needed" to the allowed notification types, used for the
-- new manager/owner alerts: a new time off request, a shift swap reaching
-- the manager-approval step, and a newly issued warning notice.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('message', 'broadcast', 'task_due', 'approval_needed'));
