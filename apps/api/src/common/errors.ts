/** Helpers for logging unknown thrown values without losing information. */

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function errorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}
