-- Inactive employees remain visible only when they are part of published history.
create policy employees_select_published_history
on public.employees for select
to authenticated
using (
  active = false
  and (select private.current_employee_id()) is not null
  and exists (
    select 1
    from public.schedule_entries entry
    join public.schedule_weeks week on week.id = entry.schedule_week_id
    where entry.employee_id = employees.id
      and week.status = 'published'
  )
);
