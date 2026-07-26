/**
 * Narrow a partial patch input down to the keys that were actually provided.
 * Keeps Prisma `update({ data })` payloads free of `undefined` overwrites.
 */
export function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
}
