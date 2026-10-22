/**
 * Loader staff IDs (LD-06 "Staff ID"): a depot prefix and four digits, KDY-0427. The Dock sign-in finds the loader
 * by this value (Keycloak attribute staff_id); the directory keeps it in User.staffId (unique) for ADM-03.
 */

/** Staff ID: 2 to 5 capital letters, a dash, 4 digits. */
export const STAFF_ID_PATTERN = /^[A-Z]{2,5}-\d{4}$/;

/** Prefix per depot: the two original depots keep their short codes; a depot registered later uses its first 3 letters. */
export const STAFF_PREFIX: Record<string, string> = { KANDY: 'KDY', PELIYAGODA: 'PLG' };

export function staffPrefix(depot: string): string {
  return STAFF_PREFIX[depot] ?? (depot.replace(/[^A-Z]/g, '').slice(0, 3) || 'STF');
}

/** Trimmed and upper-cased (staff type "kdy-0427" on the dock); null for empty. */
export function normalizeStaffId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  return s || null;
}

/** The next free number for a prefix given the IDs already taken: one above the highest (KDY-0427 -> KDY-0428). */
export function nextStaffId(prefix: string, taken: Array<string | null>): string | null {
  let max = 0;
  for (const id of taken) {
    const m = id && new RegExp(`^${prefix}-(\\d{4})$`).exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  if (max < 9999) return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  // Full at the top: the lowest unused number.
  const used = new Set(taken);
  for (let n = 1; n <= 9999; n++) {
    const id = `${prefix}-${String(n).padStart(4, '0')}`;
    if (!used.has(id)) return id;
  }
  return null;
}
