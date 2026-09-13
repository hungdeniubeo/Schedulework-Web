grant execute on function private.is_valid_availability(jsonb) to authenticated;

alter policy availability_submissions_update_own_open on public.availability_submissions
using (
  employee_id = (select private.current_employee_id())
  and (select private.registration_is_open(week_id))
)
with check (
  employee_id = (select private.current_employee_id())
  and (select private.registration_is_open(week_id))
);
