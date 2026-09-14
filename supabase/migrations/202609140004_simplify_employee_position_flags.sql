-- Remove only a Full-time label created in the initial legacy-position batch.
-- Positions created later by an admin have a different created_at value and
-- are deliberately left untouched.
do $$
declare
  initial_position_created_at timestamptz;
  incorrect_position_ids uuid[];
  cleared_employee_count integer;
  removed_position_count integer;
begin
  select min(created_at)
  into initial_position_created_at
  from public.positions;

  select array_agg(candidate.id)
  into incorrect_position_ids
  from public.positions as candidate
  where candidate.created_at = initial_position_created_at
    and regexp_replace(
      lower(btrim(candidate.name)),
      '[[:space:]-]+',
      '',
      'g'
    ) = 'fulltime'
    and exists (
      select 1
      from public.positions as batch_peer
      where batch_peer.created_at = candidate.created_at
        and batch_peer.id <> candidate.id
    );

  if incorrect_position_ids is null then
    raise notice 'No migration-generated Full-time position found.';
    return;
  end if;

  update public.employees
  set position_id = null
  where position_id = any(incorrect_position_ids);
  get diagnostics cleared_employee_count = row_count;

  delete from public.positions
  where id = any(incorrect_position_ids);
  get diagnostics removed_position_count = row_count;

  raise notice 'Cleared % employee assignments and removed % migration-generated Full-time positions.',
    cleared_employee_count,
    removed_position_count;
end;
$$;
