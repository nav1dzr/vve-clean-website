function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when a free-text `location` string (e.g. 'Islington, N1') refers to
 * the given area — matched case-insensitively against the area's name or any
 * of its postcodes. Shared by RecentJobsByArea (gallery/carpet media) and
 * AreaProofSection (reviews), so "what counts as a match for this area" is
 * defined once.
 *
 * Matches on a word boundary, not a plain substring: a plain `includes('E1')`
 * would also match inside 'E15' or 'E14', which would wrongly pull a
 * Stratford (E15) review or photo onto the Shoreditch (E1) page. `\b` fails
 * between two word characters (digits count), so 'E1' matches only a
 * standalone 'E1' token, never as a prefix of a longer postcode.
 */
export function matchesArea(
  location: string | undefined,
  areaName: string,
  postcodes: string[],
): boolean {
  if (!location) return false;
  const needles = [areaName, ...postcodes];
  return needles.some((needle) => new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i').test(location));
}
