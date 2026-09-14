/**
 * Name Similarity Utility
 *
 * Compares two names using word-overlap Jaccard similarity.
 * Designed for PAN name matching where word order may differ or
 * prefixes/suffixes may be present.
 *
 * Algorithm:
 *   1. Normalize both strings: uppercase, trim, collapse whitespace.
 *   2. Split into word sets.
 *   3. Score = |intersection| / |union| × 100 (Jaccard index × 100).
 *
 * Threshold for "match" = 80 (configurable via parameter).
 */

const DEFAULT_THRESHOLD = 80;

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a name string for comparison:
 * - Uppercase
 * - Trim leading/trailing whitespace
 * - Collapse multiple spaces into one
 * - Remove punctuation (periods, commas, apostrophes)
 */
export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[.,'\-]/g, ' ')       // replace punctuation with spaces
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
}

// ─── Similarity ───────────────────────────────────────────────────────────────

/**
 * Calculate word-overlap similarity score between two names.
 *
 * @returns Score 0–100 where 100 = identical word sets.
 */
export function nameSimilarityScore(nameA: string, nameB: string): number {
  if (!nameA || !nameB) return 0;

  const wordsA = new Set(normalizeName(nameA).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeName(nameB).split(' ').filter(Boolean));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersectionSize++;
  }

  const unionSize = new Set([...wordsA, ...wordsB]).size;

  return Math.round((intersectionSize / unionSize) * 100);
}

/**
 * Determine whether two names are a sufficient match.
 *
 * @param threshold  Minimum score required (default 80).
 */
export function namesMatch(
  nameA: string,
  nameB: string,
  threshold = DEFAULT_THRESHOLD
): boolean {
  return nameSimilarityScore(nameA, nameB) >= threshold;
}
