-- Send2U one-off demo seed: vendor pickup pins near one saved location.
--
-- WHAT THIS DOES, PLAINLY: writes pseudo-random pickup coordinates for EVERY
-- vendor row, inside a ~1km disk around one of your saved locations, so the
-- helper maps can show both points. These pins are DEMO approximations, not
-- real stall positions — they contradict the app's never-fabricate rule on
-- purpose, for demo only. Any vendor can replace theirs with the real spot
-- at any time via Vendor → Pickup pin (that writer overwrites freely).
--
-- WHAT IT DOES NOT DO: no schema change (not a migration — do not put this
-- in supabase/migrations), no app code, no order changes. The maps already
-- render vendor pins the moment these columns are non-null.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and run it
-- once, in one go (not statement-by-statement: the steps share temporary
-- tables that live for the session). Edit the anchor constant in section 1
-- first (or leave it null to auto-pick your active saved location). Read the
-- NOTICEs it prints.
-- Re-running is safe and stable: the pseudo-random per vendor is seeded by
-- the vendor id, so the same vendor always lands on the same demo pin.

-- ---------------------------------------------------------------------------
-- 1. Anchor: your saved location. EDIT the id below, or leave null.
-- ---------------------------------------------------------------------------
-- Set this to the saved-location UUID to anchor on (find it in the app:
-- Deliver-to sheet → edit icon shows it in the URL as ?id=). Null means:
-- use the table's unique is_selected row, and fail loudly if there is not
-- exactly one (the editor has no auth context, so it cannot know "you").
-- ---------------------------------------------------------------------------

do $$
declare
  v_saved_location_id uuid := null; -- e.g. '123e4567-e89b-12d3-a456-426614174000'::uuid
  v_selected_count int;
begin
  drop table if exists tmp_seed_anchor;
  -- Nullable on purpose: a pin-less anchor must land here first so the
  -- friendly check below (not a constraint violation) rejects it.
  create temporary table tmp_seed_anchor (lat double precision, lng double precision, label text not null);

  if v_saved_location_id is null then
    select count(*) into v_selected_count
      from public.send2u_saved_delivery_locations
     where is_selected;
    if v_selected_count = 0 then
      raise exception 'no selected saved location: open the Deliver-to sheet, select yours, then re-run (or paste its id above)';
    end if;
    if v_selected_count > 1 then
      raise exception 'more than one selected saved location: paste the exact id above (see the ?id= in the edit URL)';
    end if;
    insert into tmp_seed_anchor (lat, lng, label)
    select lat, lng, label
      from public.send2u_saved_delivery_locations
     where is_selected;
  else
    insert into tmp_seed_anchor (lat, lng, label)
    select lat, lng, label
      from public.send2u_saved_delivery_locations
     where id = v_saved_location_id;
    if not found then
      raise exception 'saved location % not found: check the id above', v_saved_location_id;
    end if;
  end if;

  -- A saved location without a pin cannot anchor anything: place it first
  -- in Set Location (pan the map), then re-run.
  delete from tmp_seed_anchor where lat is null or lng is null;
  if not exists (select 1 from tmp_seed_anchor) then
    raise exception 'the anchor saved location has no pin yet: place it in Set Location first, then re-run';
  end if;

  -- Safety backup of today's real pins. Temporary = lives for this editor
  -- session only: copy it out now if any vendor already had a real pin, or
  -- re-run the SELECT below after closing the tab and those rows are gone.
  drop table if exists tmp_vendor_pin_backup;
  create temporary table tmp_vendor_pin_backup as
    select id, name, pickup_lat, pickup_lng
      from public.send2u_vendors;
  raise notice 'anchor: % @ %, % — backed up % vendor rows (temp, this session only)',
    (select label from tmp_seed_anchor),
    (select lat from tmp_seed_anchor),
    (select lng from tmp_seed_anchor),
    (select count(*) from tmp_vendor_pin_backup);
end $$;

-- Eyeball today's pins BEFORE the update below overwrites them.
select id, name, pickup_lat, pickup_lng
  from public.send2u_vendors
 order by name;

-- ---------------------------------------------------------------------------
-- 2. Seed: one stable pseudo-random pin per vendor, ≤1000 m from anchor.
-- ---------------------------------------------------------------------------
-- Bearing is uniform on [0, 2π); radius uses sqrt() so points spread evenly
-- over the disk instead of bunching at the centre. Longitude is corrected
-- by cos(latitude). hashtextextended keyed by vendor id makes re-runs
-- stable: the same vendor always lands on the same demo pin.
-- ---------------------------------------------------------------------------

update public.send2u_vendors v
   set pickup_lat = a.lat
       + ((1000 * sqrt(abs(hashtextextended(v.id::text, 7) % 1000000)::double precision / 1000000.0))
          * cos(2 * pi() * (abs(hashtextextended(v.id::text, 13) % 1000000)::double precision / 1000000.0))
          / 111320.0),
       pickup_lng = a.lng
       + ((1000 * sqrt(abs(hashtextextended(v.id::text, 7) % 1000000)::double precision / 1000000.0))
          * sin(2 * pi() * (abs(hashtextextended(v.id::text, 13) % 1000000)::double precision / 1000000.0))
          / (111320.0 * cos(radians(a.lat)))),
       updated_at = now()
  from tmp_seed_anchor a;

-- ---------------------------------------------------------------------------
-- 3. Verify: every stall with its distance from the anchor, worst first.
-- ---------------------------------------------------------------------------
-- Expect: one row per vendor, all distances ≤ 1000 m. If any row exceeds it,
-- or a pin is null, do not keep the result — restore from
-- tmp_vendor_pin_backup (same session) and report back.
-- ---------------------------------------------------------------------------

select v.name,
       round((6371000 * acos(least(1, greatest(-1,
         sin(radians(a.lat)) * sin(radians(v.pickup_lat)) +
         cos(radians(a.lat)) * cos(radians(v.pickup_lat)) *
         cos(radians(v.pickup_lng - a.lng))
       ))))::numeric, 1) as distance_m,
       v.pickup_lat as pin_lat,
       v.pickup_lng as pin_lng
  from public.send2u_vendors v
  cross join tmp_seed_anchor a
 order by distance_m desc;
