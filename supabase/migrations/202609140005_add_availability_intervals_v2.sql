create or replace function private.is_valid_availability(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  day_key text;
  day_value jsonb;
  interval_value jsonb;
  start_value text;
  end_value text;
  previous_end text;
  preset_value text;
begin
  if jsonb_typeof(value) <> 'object'
    or value->>'version' not in ('1', '2')
    or jsonb_typeof(value->'days') <> 'object'
    or (select count(*) from jsonb_object_keys(value->'days')) <> 7
  then
    return false;
  end if;

  for day_key in select generate_series(1, 7)::text loop
    day_value := value->'days'->day_key;
    if day_value is null
      or jsonb_typeof(day_value) <> 'object'
      or coalesce(day_value->>'status', '') not in ('available', 'off')
    then
      return false;
    end if;

    if value->>'version' = '1' then
      if not (day_value ?& array['status', 'periods', 'start', 'end'])
        or jsonb_typeof(day_value->'periods') <> 'array'
      then
        return false;
      end if;

      if exists (
        select 1
        from jsonb_array_elements_text(day_value->'periods') as period(value)
        where period.value not in ('morning', 'afternoon', 'evening')
      ) or jsonb_array_length(day_value->'periods') <>
        (select count(distinct period.value)
         from jsonb_array_elements_text(day_value->'periods') as period(value))
      then
        return false;
      end if;

      if day_value->>'status' = 'off' then
        if jsonb_array_length(day_value->'periods') <> 0
          or jsonb_typeof(day_value->'start') <> 'null'
          or jsonb_typeof(day_value->'end') <> 'null'
        then
          return false;
        end if;
      elsif jsonb_typeof(day_value->'start') = 'null'
        and jsonb_typeof(day_value->'end') = 'null'
      then
        if jsonb_array_length(day_value->'periods') = 0 then return false; end if;
      elsif jsonb_typeof(day_value->'start') = 'string'
        and jsonb_typeof(day_value->'end') = 'string'
      then
        if (day_value->>'start') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
          or (day_value->>'end') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
          or (day_value->>'start') >= (day_value->>'end')
        then
          return false;
        end if;
      else
        return false;
      end if;
      continue;
    end if;

    if not (day_value ?& array['status', 'preset', 'intervals'])
      or jsonb_typeof(day_value->'intervals') <> 'array'
    then
      return false;
    end if;
    if day_value->>'status' = 'off' then
      if jsonb_typeof(day_value->'preset') <> 'null'
        or jsonb_array_length(day_value->'intervals') <> 0
      then
        return false;
      end if;
      continue;
    end if;

    preset_value := day_value->>'preset';
    if preset_value not in (
      'morning', 'morning_afternoon', 'evening', 'full', 'afternoon_evening'
    ) or jsonb_array_length(day_value->'intervals') <>
      (case when preset_value = 'full' then 2 else 1 end)
    then
      return false;
    end if;

    previous_end := null;
    for interval_value in
      select * from pg_catalog.jsonb_array_elements(day_value->'intervals')
    loop
      if jsonb_typeof(interval_value) <> 'object'
        or not (interval_value ?& array['start', 'end'])
        or jsonb_typeof(interval_value->'start') <> 'string'
        or jsonb_typeof(interval_value->'end') <> 'string'
      then
        return false;
      end if;
      start_value := interval_value->>'start';
      end_value := interval_value->>'end';
      if start_value !~ '^(?:[01][0-9]|2[0-3]):00$'
        or end_value !~ '^(?:[01][0-9]|2[0-3]):00$'
        or start_value >= end_value
        or (previous_end is not null and previous_end >= start_value)
      then
        return false;
      end if;
      previous_end := end_value;
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

comment on function private.is_valid_availability(jsonb) is
  'Validates legacy version 1 availability and hour-only interval-based version 2 availability.';
