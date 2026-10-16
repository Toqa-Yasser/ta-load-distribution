import { useState } from "react";

/**
 * Returns `value`, or the last non-null value it had once it becomes null/undefined. Lets a
 * dialog keep showing what it was opened for while it animates out after the caller clears it.
 */
export function useRetained<T>(value: T | null | undefined): T | null {
  const [kept, setKept] = useState<T | null>(value ?? null);
  // Adjusting state during render (not in an effect) so the retained value is never a frame stale.
  if (value != null && value !== kept) setKept(value);
  return value ?? kept;
}
