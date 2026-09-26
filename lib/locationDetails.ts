import type { SavedLocationType } from '@/types/domain';

/**
 * Pure Set Location logic: category vocabulary, label/sub-details resolution,
 * and form validation. Deliberately free of React Native, Expo, and Supabase
 * imports so it runs under plain `node --test` and is reusable by any writer
 * or reader of a saved location.
 *
 * Nothing here names a real building, block, or coordinate: resolution is
 * generic composition (join non-empty parts), never a lookup table.
 */

/** Delivery instructions ceiling, enforced by the input and the database. */
export const INSTRUCTIONS_MAX_LENGTH = 500;

/** Single-line field ceiling, mirroring the database checks. */
export const LOCATION_FIELD_MAX_LENGTH = 120;

/**
 * Label categories offered by the Set Location selector. Data-driven on
 * purpose: a new category is one array entry here, one icon entry in the
 * sheet's icon map, and one value in the database check — no redesign.
 * `library` and `cafeteria` stay valid for rows written against the earlier
 * vocabulary; the form offers the full set so no stored row is orphaned.
 */
export interface LocationCategory {
  type: SavedLocationType;
  label: string;
}

export const LOCATION_CATEGORIES: readonly LocationCategory[] = [
  { type: 'home', label: 'Home' },
  { type: 'class', label: 'Class/Academic' },
  { type: 'hostel', label: 'Hostel' },
  { type: 'library', label: 'Library' },
  { type: 'cafeteria', label: 'Cafeteria/Dining' },
  { type: 'office', label: 'Office' },
  { type: 'other', label: 'Other' },
];

const KNOWN_TYPES: readonly string[] = LOCATION_CATEGORIES.map((category) => category.type);

export function isSavedLocationType(value: unknown): value is SavedLocationType {
  return typeof value === 'string' && KNOWN_TYPES.includes(value);
}

export function categoryLabelOf(type: SavedLocationType): string {
  return LOCATION_CATEGORIES.find((category) => category.type === type)?.label ?? 'Other';
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function cleanOrNull(value: string | null | undefined): string | null {
  const trimmed = clean(value);
  return trimmed.length > 0 ? trimmed : null;
}

export interface LocationTextParts {
  building?: string | null;
  block?: string | null;
  floorLevel?: string | null;
  roomUnit?: string | null;
  category?: SavedLocationType | null;
  customLabel?: string | null;
}

/**
 * What gets stored (and shown) as the row's primary label: the custom label
 * for `other`, otherwise the building. Blank when neither is present, which
 * validation rejects before anything is written.
 */
export function resolveSavedLabel(parts: LocationTextParts): string {
  if (parts.category === 'other') return clean(parts.customLabel);
  return clean(parts.building);
}

/**
 * What gets stored (and shown) as the secondary line: the non-empty
 * block/floor/room parts joined with middots, or null when there are none.
 */
export function resolveSavedSubDetails(parts: LocationTextParts): string | null {
  const rest = [cleanOrNull(parts.block), cleanOrNull(parts.floorLevel), cleanOrNull(parts.roomUnit)].filter(
    (part): part is string => part !== null,
  );
  return rest.length > 0 ? rest.join(' · ') : null;
}

/**
 * The summary card's resolved location text: label plus sub-details, or the
 * empty string when the form has produced nothing yet.
 */
export function resolveLocationText(parts: LocationTextParts): string {
  const label = resolveSavedLabel(parts);
  const subDetails = resolveSavedSubDetails(parts);
  return [label === '' ? null : label, subDetails].filter((part): part is string => part !== null).join(', ');
}

/** Stable coordinate rendering for the summary card (6 decimal places). */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export interface SetLocationValidation {
  building: string;
  category: SavedLocationType | null;
  customLabel: string;
  instructions: string;
  /** True once the map has reported a real centre (or an edit pin exists). */
  hasPin: boolean;
}

export interface SetLocationErrors {
  building?: string;
  category?: string;
  customLabel?: string;
  instructions?: string;
  pin?: string;
}

export function validateSetLocation(input: SetLocationValidation): SetLocationErrors {
  const errors: SetLocationErrors = {};
  const building = clean(input.building);
  if (building === '') {
    errors.building = 'Enter the building or facility.';
  } else if (building.length > LOCATION_FIELD_MAX_LENGTH) {
    errors.building = `Keep the building under ${LOCATION_FIELD_MAX_LENGTH} characters.`;
  }
  if (!input.category || !isSavedLocationType(input.category)) {
    errors.category = 'Choose a location label.';
  } else if (input.category === 'other') {
    const custom = clean(input.customLabel);
    if (custom === '') {
      errors.customLabel = 'Name this location.';
    } else if (custom.length > LOCATION_FIELD_MAX_LENGTH) {
      errors.customLabel = `Keep the name under ${LOCATION_FIELD_MAX_LENGTH} characters.`;
    }
  }
  if (input.instructions.length > INSTRUCTIONS_MAX_LENGTH) {
    errors.instructions = `Keep instructions under ${INSTRUCTIONS_MAX_LENGTH} characters.`;
  }
  if (!input.hasPin) {
    errors.pin = 'Pan the map so the centre pin sits on your delivery spot.';
  }
  return errors;
}

export function isSetLocationValid(errors: SetLocationErrors): boolean {
  return Object.keys(errors).length === 0;
}
