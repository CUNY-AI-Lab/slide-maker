import { LAYOUT_ZONES, MODULE_TYPES, type SlideLayout, type ModuleType, type Zone } from './block-types.js'

const CUNY_EMAIL_REGEX = /^.+@.+\.cuny\.edu$/i

export function isValidCunyEmail(email: string): boolean {
  return CUNY_EMAIL_REGEX.test(email)
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Module Validation ───────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
}

/**
 * Validate that a module type is one of the 14 recognized types.
 */
export function isValidModuleType(type: string): type is ModuleType {
  return (MODULE_TYPES as readonly string[]).includes(type)
}

/**
 * Validate that a zone is valid for the given layout.
 */
export function isValidZoneForLayout(zone: string, layout: string): boolean {
  const zones = LAYOUT_ZONES[layout as SlideLayout]
  if (!zones) return false
  return (zones as readonly string[]).includes(zone)
}

/**
 * Validate a module placement: checks type, zone, and zone-layout compatibility.
 * Returns an array of errors (empty = valid).
 */
export function validateModulePlacement(
  moduleType: string,
  zone: string,
  layout: string,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!isValidModuleType(moduleType)) {
    errors.push({
      field: 'type',
      message: `Unknown module type "${moduleType}". Valid types: ${MODULE_TYPES.join(', ')}`,
    })
  }

  if (!(layout in LAYOUT_ZONES)) {
    errors.push({
      field: 'layout',
      message: `Unknown layout "${layout}".`,
    })
  } else if (!isValidZoneForLayout(zone, layout)) {
    const validZones = LAYOUT_ZONES[layout as SlideLayout]
    errors.push({
      field: 'zone',
      message: `Zone "${zone}" is not valid for layout "${layout}". Valid zones: ${validZones.join(', ')}`,
    })
  }

  return errors
}

/**
 * Guard against runaway AI: max slides per deck.
 */
export const MAX_SLIDES_PER_DECK = 60

export function isSlideCountWithinLimit(currentCount: number, adding: number = 1): boolean {
  return currentCount + adding <= MAX_SLIDES_PER_DECK
}
