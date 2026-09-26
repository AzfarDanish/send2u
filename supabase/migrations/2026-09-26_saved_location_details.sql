-- Send2U saved locations: structured form fields + wider label categories.
--
-- Why this is necessary, in one paragraph: the address-book table stores only
-- a free label, sub-details, a type, and a pin, but the Set Location page
-- collects structured fields (building, block, floor/level, room/unit,
-- delivery instructions, custom label for `other`) that the edit flow must
-- read back faithfully — composing them client-side into label/sub-details
-- would lose the structure on reload. This migration adds exactly those
-- columns, widens the label vocabulary for the form's categories
-- (class/academic and hostel join the existing five), and replaces the
-- create/update writers with versions that validate and store the new fields.
--
-- Ordering: apply AFTER `2026-09-26_saved_delivery_locations.sql`, which owns
-- the table and the delete/set-active writers (untouched here).
--
-- House rules, as before: SELECT-only table policies (unchanged), writes
-- through `send2u_*` SECURITY DEFINER functions, nothing granted to `anon`.
--
-- Apply in the Supabase SQL editor. Safe to run twice.

-- ---------------------------------------------------------------------------
-- 1. Structured columns for the Set Location form
-- ---------------------------------------------------------------------------

alter table public.send2u_saved_delivery_locations
  add column if not exists building text check (building is null or char_length(building) between 1 and 120),
  add column if not exists block text check (block is null or char_length(block) between 1 and 120),
  add column if not exists floor_level text check (floor_level is null or char_length(floor_level) between 1 and 120),
  add column if not exists room_unit text check (room_unit is null or char_length(room_unit) between 1 and 120),
  add column if not exists instructions text check (instructions is null or char_length(instructions) between 1 and 500),
  add column if not exists custom_label text check (custom_label is null or char_length(custom_label) between 1 and 120);

-- The form's categories: home, class/academic, hostel, office, other, keeping
-- library and cafeteria valid for rows written against the earlier vocabulary.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'send2u_saved_delivery_locations_location_type_check') then
    alter table public.send2u_saved_delivery_locations
      drop constraint send2u_saved_delivery_locations_location_type_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'send2u_saved_location_type_valid') then
    alter table public.send2u_saved_delivery_locations
      add constraint send2u_saved_location_type_valid check (
        location_type in ('home', 'library', 'class', 'hostel', 'cafeteria', 'office', 'other')
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Replaced writers (extended signatures, same names and guarantees)
-- ---------------------------------------------------------------------------

-- The old 5-argument overloads must go: same-name overloads would leave
-- PostgREST with an ambiguous RPC. The delete/set-active writers are
-- unaffected and stay exactly as they are.
drop function if exists public.send2u_create_saved_location(text, text, text, double precision, double precision);
drop function if exists public.send2u_update_saved_location(uuid, text, text, text, double precision, double precision);

-- Creates one saved location for the caller, with the form's structured
-- fields. Label/sub-details still carry the display composition (the sheet
-- reads those two columns); the structured columns are what the edit flow
-- reads back. The caller's first location becomes the active one.
create function public.send2u_create_saved_location(
  p_label text,
  p_sub_details text default null,
  p_location_type text default 'other',
  p_lat double precision default null,
  p_lng double precision default null,
  p_building text default null,
  p_block text default null,
  p_floor_level text default null,
  p_room_unit text default null,
  p_instructions text default null,
  p_custom_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_label text := btrim(coalesce(p_label, ''));
  v_sub text := nullif(btrim(coalesce(p_sub_details, '')), '');
  v_type text := coalesce(nullif(btrim(coalesce(p_location_type, '')), ''), 'other');
  v_building text := nullif(btrim(coalesce(p_building, '')), '');
  v_block text := nullif(btrim(coalesce(p_block, '')), '');
  v_floor text := nullif(btrim(coalesce(p_floor_level, '')), '');
  v_room text := nullif(btrim(coalesce(p_room_unit, '')), '');
  v_instructions text := nullif(btrim(coalesce(p_instructions, '')), '');
  v_custom text := nullif(btrim(coalesce(p_custom_label, '')), '');
  v_first boolean;
  v_row public.send2u_saved_delivery_locations%rowtype;
begin
  if v_uid is null then
    raise exception 'sign-in is required to save a location' using errcode = '42501';
  end if;
  if char_length(v_label) < 1 or char_length(v_label) > 120 then
    raise exception 'a location label of 1-120 characters is required' using errcode = '22023';
  end if;
  if v_sub is not null and char_length(v_sub) > 240 then
    raise exception 'location details must be 240 characters or fewer' using errcode = '22023';
  end if;
  if v_type not in ('home', 'library', 'class', 'hostel', 'cafeteria', 'office', 'other') then
    raise exception 'unknown location type' using errcode = '22023';
  end if;
  if v_type = 'other' and v_custom is null then
    raise exception 'a custom name is required for an other location' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'saved location coordinates are invalid' using errcode = '22023';
  end if;
  if coalesce(char_length(v_building), 0) > 120
     or coalesce(char_length(v_block), 0) > 120
     or coalesce(char_length(v_floor), 0) > 120
     or coalesce(char_length(v_room), 0) > 120
     or coalesce(char_length(v_custom), 0) > 120 then
    raise exception 'location fields must be 120 characters or fewer' using errcode = '22023';
  end if;
  if coalesce(char_length(v_instructions), 0) > 500 then
    raise exception 'delivery instructions must be 500 characters or fewer' using errcode = '22023';
  end if;

  select not exists (
    select 1 from public.send2u_saved_delivery_locations where user_id = v_uid
  ) into v_first;

  insert into public.send2u_saved_delivery_locations
    (user_id, label, sub_details, location_type, is_selected, lat, lng,
     building, block, floor_level, room_unit, instructions, custom_label)
  values
    (v_uid, v_label, v_sub, v_type, coalesce(v_first, true), p_lat, p_lng,
     v_building, v_block, v_floor, v_room, v_instructions, v_custom)
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'label', v_row.label,
    'sub_details', v_row.sub_details,
    'location_type', v_row.location_type,
    'is_selected', v_row.is_selected,
    'lat', v_row.lat,
    'lng', v_row.lng
  );
end;
$$;

revoke all on function public.send2u_create_saved_location(text, text, text, double precision, double precision, text, text, text, text, text, text) from public;
revoke all on function public.send2u_create_saved_location(text, text, text, double precision, double precision, text, text, text, text, text, text) from anon;
grant execute on function public.send2u_create_saved_location(text, text, text, double precision, double precision, text, text, text, text, text, text) to authenticated;

-- Edits one owned location, structured fields included. Selection never
-- changes here; the setter owns it.
create function public.send2u_update_saved_location(
  p_id uuid,
  p_label text,
  p_sub_details text default null,
  p_location_type text default 'other',
  p_lat double precision default null,
  p_lng double precision default null,
  p_building text default null,
  p_block text default null,
  p_floor_level text default null,
  p_room_unit text default null,
  p_instructions text default null,
  p_custom_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_label text := btrim(coalesce(p_label, ''));
  v_sub text := nullif(btrim(coalesce(p_sub_details, '')), '');
  v_type text := coalesce(nullif(btrim(coalesce(p_location_type, '')), ''), 'other');
  v_building text := nullif(btrim(coalesce(p_building, '')), '');
  v_block text := nullif(btrim(coalesce(p_block, '')), '');
  v_floor text := nullif(btrim(coalesce(p_floor_level, '')), '');
  v_room text := nullif(btrim(coalesce(p_room_unit, '')), '');
  v_instructions text := nullif(btrim(coalesce(p_instructions, '')), '');
  v_custom text := nullif(btrim(coalesce(p_custom_label, '')), '');
  v_row public.send2u_saved_delivery_locations%rowtype;
begin
  if v_uid is null then
    raise exception 'sign-in is required to edit a location' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'a saved location is required' using errcode = '22023';
  end if;
  if char_length(v_label) < 1 or char_length(v_label) > 120 then
    raise exception 'a location label of 1-120 characters is required' using errcode = '22023';
  end if;
  if v_sub is not null and char_length(v_sub) > 240 then
    raise exception 'location details must be 240 characters or fewer' using errcode = '22023';
  end if;
  if v_type not in ('home', 'library', 'class', 'hostel', 'cafeteria', 'office', 'other') then
    raise exception 'unknown location type' using errcode = '22023';
  end if;
  if v_type = 'other' and v_custom is null then
    raise exception 'a custom name is required for an other location' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'saved location coordinates are invalid' using errcode = '22023';
  end if;
  if coalesce(char_length(v_building), 0) > 120
     or coalesce(char_length(v_block), 0) > 120
     or coalesce(char_length(v_floor), 0) > 120
     or coalesce(char_length(v_room), 0) > 120
     or coalesce(char_length(v_custom), 0) > 120 then
    raise exception 'location fields must be 120 characters or fewer' using errcode = '22023';
  end if;
  if coalesce(char_length(v_instructions), 0) > 500 then
    raise exception 'delivery instructions must be 500 characters or fewer' using errcode = '22023';
  end if;

  update public.send2u_saved_delivery_locations
     set label = v_label,
         sub_details = v_sub,
         location_type = v_type,
         lat = p_lat,
         lng = p_lng,
         building = v_building,
         block = v_block,
         floor_level = v_floor,
         room_unit = v_room,
         instructions = v_instructions,
         custom_label = v_custom,
         updated_at = now()
   where id = p_id
     and user_id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'saved location not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'label', v_row.label,
    'sub_details', v_row.sub_details,
    'location_type', v_row.location_type,
    'is_selected', v_row.is_selected,
    'lat', v_row.lat,
    'lng', v_row.lng
  );
end;
$$;

revoke all on function public.send2u_update_saved_location(uuid, text, text, text, double precision, double precision, text, text, text, text, text, text) from public;
revoke all on function public.send2u_update_saved_location(uuid, text, text, text, double precision, double precision, text, text, text, text, text, text) from anon;
grant execute on function public.send2u_update_saved_location(uuid, text, text, text, double precision, double precision, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Verification (read-only; run after applying)
-- ---------------------------------------------------------------------------

-- 1. Columns and the widened type check:
--    select column_name from information_schema.columns
--     where table_name = 'send2u_saved_delivery_locations' order by ordinal_position;
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'send2u_saved_location_type_valid';
--
-- 2. Exactly one overload per writer, none of the old 5-argument shapes:
--    select proname, pg_get_function_arguments(oid) from pg_proc
--     where proname like 'send2u\_%\_saved\_location' order by proname;

-- ---------------------------------------------------------------------------
-- What this migration does NOT do
-- ---------------------------------------------------------------------------
-- It does not touch the owner SELECT policy, the one-selected-per-user index,
-- or the delete/set-active writers. It adds no realtime publication: an
-- address book is read on open, not streamed.
