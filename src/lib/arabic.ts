/**
 * Arabic text helpers shared by the map features and the permission layer.
 * Promoted out of features/Map/businessMap.ts so `src/lib` code can normalize
 * layer names without importing a feature (repo rule 8).
 */

/**
 * Unify hamza/alef forms, strip tatweel, and collapse whitespace so config labels match
 * the service's sublayer titles even when the service spells them slightly differently
 * (e.g. "الأرضية" vs "الارضية", double spaces).
 */
export function normalizeArabicTitle(title: string): string {
  return title
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
