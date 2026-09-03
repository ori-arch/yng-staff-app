-- Same cleanup as cleanup_mock_data.sql, but commits automatically at the
-- end so there's no separate "type commit;" step to forget. Run
-- cleanup_preview_mock_employees.sql first if you haven't already, to
-- confirm the 5 names match exactly who you expect.
--
-- What this does:
--   1. Wipes ALL shift schedule data (every recurring pattern and one-off
--      exception, for every employee) and ALL checklist submission history
--      (every opening/closing checklist ever submitted, for every
--      employee) -- a full reset, not just for the mock employees.
--   2. Removes the 5 mock employees (Amy, Bree, Lexi, Megan, Nielie) and
--      every row elsewhere that belongs to them.
--
-- Does NOT touch checklist_templates, rooms, broadcast_templates, or
-- backbar_items/par levels.

begin;

delete from checklist_submissions;   -- cascades to checklist_submission_items
delete from shift_patterns;
delete from shift_exceptions;

create temporary table mock_employee_ids as
select id from employees
where name ilike 'amy%'
   or name ilike 'bree%'
   or name ilike 'lexi%'
   or name ilike 'megan%'
   or name ilike 'nielie%';

update protocols set uploaded_by = null
  where uploaded_by in (select id from mock_employee_ids);
update warning_notices set issued_by = null
  where issued_by in (select id from mock_employee_ids);
update time_off_requests set approved_by = null
  where approved_by in (select id from mock_employee_ids);
update time_off_balance_adjustments set adjusted_by = null
  where adjusted_by in (select id from mock_employee_ids);
update shift_swap_requests set decided_by = null
  where decided_by in (select id from mock_employee_ids);
update messages set sender_id = null
  where sender_id in (select id from mock_employee_ids);

delete from equipment_logs where employee_id in (select id from mock_employee_ids);
delete from restock_runner_logs where employee_id in (select id from mock_employee_ids);
delete from loft_cleaning_logs where employee_id in (select id from mock_employee_ids);
delete from room_restocking_logs where employee_id in (select id from mock_employee_ids);
delete from channel_members where employee_id in (select id from mock_employee_ids);
delete from alert_acknowledgements where employee_id in (select id from mock_employee_ids);
delete from warning_notices where employee_id in (select id from mock_employee_ids);
delete from time_off_requests where employee_id in (select id from mock_employee_ids);
delete from time_off_balance_adjustments where employee_id in (select id from mock_employee_ids);
delete from shift_swap_requests
  where requesting_employee_id in (select id from mock_employee_ids)
     or target_employee_id in (select id from mock_employee_ids);
delete from push_subscriptions where employee_id in (select id from mock_employee_ids);
delete from notifications where employee_id in (select id from mock_employee_ids);

delete from employees where id in (select id from mock_employee_ids);

commit;

-- Sanity check: should return 0 rows.
select id, name from employees
where name ilike 'amy%'
   or name ilike 'bree%'
   or name ilike 'lexi%'
   or name ilike 'megan%'
   or name ilike 'nielie%';
