-- Send2U saved delivery locations — per-user address book for the Deliver-to sheet.
--
-- Why this is necessary, in one paragraph: `send2u_delivery_locations` holds a
-- fixed set of shared campus drop-off points (read-only curated data with no
-- owner, no type, no free-text sub-details, and no selected state), so the
-- Deliver-to bottom sheet's saved-location list — radio-selected active
-- location, per-type icons (home/library/cafeteria/office/other), arbitrary
-- labels and sub-details, edit and add flows — has nowhere to live. This
-- migration adds exactly that: one row per saved location, owned by the
-- requester who created it.
--
-- Deliberately absent: any change to `send2u_delivery_locations` (the shared
-- points stay curated and SELECT-only), any new order status or lifecycle
-- column, any GPS history.
--
-- House rules this file follows, read from the live policies and the function
-- list rather than assumed:
--   * Tables carry SELECT-only policies. Every write goes through a `send2u_*`
--     SECURITY DEFINER function, so the four mutators below are functions,
--     not INSERT/UPDATE/DELETE policies.
--   * Policies read `( select auth.uid() as uid )` and nothing is granted to
--     `anon`; function EXECUTE is revoked from `public` before being granted
--     to `authenticated`.
--
-- Apply in the Supabase SQL editor. Safe to run twice.

-- ---------------------------------------------------------------------------
-- 1. Table: one saved location per row, owned by its creator
-- ---------------------------------------------------------------------------

create table if not exists public.send2u_saved_delivery_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Primary label shown in the sheet (e.g. "Home", "KK Block C").
  label text not null check (char_length(label) between 1 and 120),
  -- Secondary line (e.g. block, level, room). Null when the user gave none.
  sub_details text check (sub_details is null or char_length(sub_details) between 1 and 240),
  -- Sheet icon category: home | library | cafeteria | office | other.
  location_type text not null default 'other'
    check (location_type in ('home', 'library', 'cafeteria', 'office', 'other')),
  -- Single-select active location. The partial unique index below enforces
  -- one selected row per user; the setter function owns the switch.
  is_selected boolean not null default false,
  -- Optional pin from the Set Location flow. Either fully set or fully absent.
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (lat is null and lng is null)
    or (lat between -90 and 90 and lng between -180 and 180)
  )
);

-- Owner lookups and the FK back-reference need indexes of their own.
create index if not exists send2u_saved_delivery_locations_user_idx
  on public.send2u_saved_delivery_locations (user_id);

-- Exactly one active location per user, enforced where it cannot drift.
create unique index if not exists send2u_saved_delivery_locations_one_selected_per_user
  on public.send2u_saved_delivery_locations (user_id)
  where is_selected;

alter table public.send2u_saved_delivery_locations enable row level security;

grant select on public.send2u_saved_delivery_locations to authenticated;
revoke all on public.send2u_saved_delivery_locations from anon;

-- Owners read only their own rows. No INSERT/UPDATE/DELETE policies on
-- purpose: writes go through the functions in section 2.
drop policy if exists "send2u_saved_delivery_locations_select_own"
  on public.send2u_saved_delivery_locations;
create policy "send2u_saved_delivery_locations_select_own"
  on public.send2u_saved_delivery_locations
  for select to authenticated
  using (user_id = ( select auth.uid() as uid ));

-- ---------------------------------------------------------------------------
-- 2. Write paths (functions, matching every other write in this project)
-- ---------------------------------------------------------------------------

-- Creates one saved location for the caller. The caller's first location
-- becomes the active one so the home header always has something to show;
-- later rows start unselected and the sheet's setter owns the switch.
create or replace function public.send2u_create_saved_location(
  p_label text,
  p_sub_details text default null,
  p_location_type text default 'other',
  p_lat double precision default null,
  p_lng double precision default null
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
  if v_type not in ('home', 'library', 'cafeteria', 'office', 'other') then
    raise exception 'unknown location type' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'saved location coordinates are invalid' using errcode = '22023';
  end if;

  select not exists (
    select 1 from public.send2u_saved_delivery_locations where user_id = v_uid
  ) into v_first;

  insert into public.send2u_saved_delivery_locations
    (user_id, label, sub_details, location_type, is_selected, lat, lng)
  values
    (v_uid, v_label, v_sub, v_type, coalesce(v_first, true), p_lat, p_lng)
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

revoke all on function public.send2u_create_saved_location(text, text, text, double precision, double precision) from public;
revoke all on function public.send2u_create_saved_location(text, text, text, double precision, double precision) from anon;
grant execute on function public.send2u_create_saved_location(text, text, text, double precision, double precision) to authenticated;

-- Edits one owned location. Selection never changes here; the setter owns it.
create or replace function public.send2u_update_saved_location(
  p_id uuid,
  p_label text,
  p_sub_details text default null,
  p_location_type text default 'other',
  p_lat double precision default null,
  p_lng double precision default null
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
  if v_type not in ('home', 'library', 'cafeteria', 'office', 'other') then
    raise exception 'unknown location type' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'saved location coordinates are invalid' using errcode = '22023';
  end if;

  update public.send2u_saved_delivery_locations
     set label = v_label,
         sub_details = v_sub,
         location_type = v_type,
         lat = p_lat,
         lng = p_lng,
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

revoke all on function public.send2u_update_saved_location(uuid, text, text, text, double precision, double precision) from public;
revoke all on function public.send2u_update_saved_location(uuid, text, text, text, double precision, double precision) from anon;
grant execute on function public.send2u_update_saved_location(uuid, text, text, text, double precision, double precision) to authenticated;

-- Deletes one owned location. When the active row goes, the oldest remaining
-- row is promoted so the sheet never drops to no selection by accident.
create or replace function public.send2u_delete_saved_location(
  p_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_was_selected boolean;
begin
  if v_uid is null then
    raise exception 'sign-in is required to delete a location' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'a saved location is required' using errcode = '22023';
  end if;

  select is_selected into v_was_selected
    from public.send2u_saved_delivery_locations
   where id = p_id
     and user_id = v_uid;

  if not found then
    raise exception 'saved location not found' using errcode = 'P0002';
  end if;

  delete from public.send2u_saved_delivery_locations
   where id = p_id
     and user_id = v_uid;

  if coalesce(v_was_selected, false) then
    update public.send2u_saved_delivery_locations
       set is_selected = true,
           updated_at = now()
     where id = (
       select id from public.send2u_saved_delivery_locations
        where user_id = v_uid
        order by created_at asc
        limit 1
     );
  end if;

  return jsonb_build_object('id', p_id);
end;
$$;

revoke all on function public.send2u_delete_saved_location(uuid) from public;
revoke all on function public.send2u_delete_saved_location(uuid) from anon;
grant execute on function public.send2u_delete_saved_location(uuid) to authenticated;

-- Switches the active location. One statement clears the old row and sets the
-- new one, so the partial unique index never sees two selected rows.
create or replace function public.send2u_set_active_saved_location(
  p_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign-in is required to choose a location' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'a saved location is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.send2u_saved_delivery_locations
     where id = p_id
       and user_id = v_uid
  ) then
    raise exception 'saved location not found' using errcode = 'P0002';
  end if;

  update public.send2u_saved_delivery_locations
     set is_selected = (id = p_id),
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('id', p_id);
end;
$$;

revoke all on function public.send2u_set_active_saved_location(uuid) from public;
revoke all on function public.send2u_set_active_saved_location(uuid) from anon;
grant execute on function public.send2u_set_active_saved_location(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Verification (read-only; run after applying)
-- ---------------------------------------------------------------------------

-- 1. Table, RLS, and policies:
--    select relrowsecurity from pg_class where relname = 'send2u_saved_delivery_locations';
--    select policyname, cmd, roles from pg_policies
--     where tablename = 'send2u_saved_delivery_locations' order by policyname;
--    select indexname from pg_indexes
--     where tablename = 'send2u_saved_delivery_locations' order by indexname;
--
-- 2. Functions and their grants:
--    select proname from pg_proc
--     where proname like 'send2u\_%\_saved\_location' order by proname;
--
-- 3. Confirming nothing is world-readable: the table must return zero rows for
--    `anon`, and every function above must reject a call without a session.

-- ---------------------------------------------------------------------------
-- What this migration does NOT do
-- ---------------------------------------------------------------------------
-- It does not touch `send2u_delivery_locations` (shared campus points stay
-- curated and read-only), adds no UPDATE/DELETE table policies (writes stay
-- inside the functions above), and publishes nothing to realtime (an address
-- book is read on open, not streamed).
