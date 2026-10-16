import { useState } from "react";

/**
 * Returns `value`, or the last non-null value it had once it becomes null/undefined. Lets a
 * dialog keep showing what it was opened for while it animates out after the caller clears it.
 *
 * `value` must be referentially stable while it means the same thing (state, a memoised lookup):
 * a fresh object on every render never equals `kept`, so each render would set state again and
 * loop. Wrap derived values in useMemo before passing them.
 */
export function useRetained<T>(value: T | null | undefined): T | null {
  const [kept, setKept] = useState<T | null>(value ?? null);
  // Adjusting state during render (not in an effect) so the retained value is never a frame stale.
  if (value != null && value !== kept) setKept(value);
  return value ?? kept;
}
