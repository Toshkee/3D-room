/**
 * Coarse "is this a low-power / touch device?" check, evaluated once at import.
 * Used to scale back the most expensive GPU work (floor reflections, MSAA) so
 * the scene stays smooth on a phone.
 */
export const LOW_POWER =
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
