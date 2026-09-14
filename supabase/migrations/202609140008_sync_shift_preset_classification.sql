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
  interval_index bigint;
  start_value text;
  end_value text;
  previous_end text;
  preset_value text;
  off_reason_value jsonb;
begin
  if jsonb_typeof(value) <> 'object'
    or value->>'version' not in ('1', '2')
    or jsonb_typeof(value->'days') <> 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(value->'days')) <> 7
  then
    return false;
  end if;

  for day_key in select pg_catalog.generate_series(1, 7)::text loop
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
        from pg_catalog.jsonb_array_elements_text(day_value->'periods') period(value)
        where period.value not in ('morning', 'afternoon', 'evening')
      ) or pg_catalog.jsonb_array_length(day_value->'periods') <>
        (select count(distinct period.value)
         from pg_catalog.jsonb_array_elements_text(day_value->'periods') period(value))
      then
        return false;
      end if;
      if day_value->>'status' = 'off' then
        if pg_catalog.jsonb_array_length(day_value->'periods') <> 0
          or jsonb_typeof(day_value->'start') <> 'null'
          or jsonb_typeof(day_value->'end') <> 'null'
        then
          return false;
        end if;
      elsif jsonb_typeof(day_value->'start') = 'null'
        and jsonb_typeof(day_value->'end') = 'null'
      then
        if pg_catalog.jsonb_array_length(day_value->'periods') = 0 then
          return false;
        end if;
      elsif jsonb_typeof(day_value->'start') <> 'string'
        or jsonb_typeof(day_value->'end') <> 'string'
        or day_value->>'start' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        or day_value->>'end' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        or day_value->>'start' >= day_value->>'end'
      then
        return false;
      end if;
      continue;
    end if;

    if not (day_value ?& array['status', 'preset', 'intervals'])
      or jsonb_typeof(day_value->'intervals') <> 'array'
    then
      return false;
    end if;
    if day_value ? 'offReason' then
      off_reason_value := day_value->'offReason';
      if jsonb_typeof(off_reason_value) not in ('string', 'null')
        or (jsonb_typeof(off_reason_value) = 'string'
          and char_length(btrim(day_value->>'offReason')) > 120)
      then
        return false;
      end if;
    end if;

    if day_value->>'status' = 'off' then
      if jsonb_typeof(day_value->'preset') <> 'null'
        or pg_catalog.jsonb_array_length(day_value->'intervals') <> 0
      then
        return false;
      end if;
      continue;
    end if;

    if day_value ? 'offReason'
      and jsonb_typeof(day_value->'offReason') = 'string'
      and btrim(day_value->>'offReason') <> ''
    then
      return false;
    end if;
    preset_value := day_value->>'preset';
    if preset_value not in (
      'morning', 'morning_afternoon', 'afternoon',
      'afternoon_evening', 'evening', 'full'
    ) or pg_catalog.jsonb_array_length(day_value->'intervals') <>
      (case when preset_value = 'full' then 2 else 1 end)
    then
      return false;
    end if;

    previous_end := null;
    for interval_value, interval_index in
      select item.value, item.ordinality
      from pg_catalog.jsonb_array_elements(day_value->'intervals')
        with ordinality item(value, ordinality)
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
      if start_value !~ '^(?:1[0-9]|2[0-3]):00$'
        or end_value !~ '^(?:1[0-9]|2[0-3]):00$'
        or start_value < '10:00'
        or end_value > '23:00'
        or start_value >= end_value
        or (previous_end is not null and previous_end >= start_value)
      then
        return false;
      end if;

      if (preset_value = 'morning'
          and (start_value >= '14:00' or end_value > '14:00'))
        or (preset_value = 'morning_afternoon'
          and (start_value >= '14:00' or end_value <= '14:00' or end_value > '18:00'))
        or (preset_value = 'afternoon'
          and (start_value < '14:00' or start_value >= '17:00' or end_value > '18:00'))
        or (preset_value = 'afternoon_evening'
          and (start_value < '14:00' or start_value >= '17:00' or end_value <= '18:00' or end_value > '23:00'))
        or (preset_value = 'evening'
          and (start_value < '17:00' or end_value > '23:00'))
        or (preset_value = 'full' and interval_index = 1
          and (start_value < '10:00' or start_value >= '14:00' or end_value > '14:00'))
        or (preset_value = 'full' and interval_index = 2
          and (start_value < '17:00' or end_value > '23:00'))
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
  'Validates legacy v1 and two-way classified whole-hour v2 availability with optional off reasons.';
