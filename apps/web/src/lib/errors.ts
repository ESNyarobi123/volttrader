import { toast } from "sonner";
import { ApiRequestError } from "./api";

export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * For failures the UI recovers from (cached data, partial state): the page keeps
 * working, but the user and the console still learn that something failed.
 */
export function reportRecoveredError(summary: string, err: unknown): void {
  console.error(summary, err);
  toast.error(summary, { description: apiErrorMessage(err) });
}
