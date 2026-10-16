import { useEffect, useRef, type KeyboardEvent } from "react";

/** Shared text-input look for the Team page (44px tall). */
export const INPUT_CLASS =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-ink transition-colors hover:border-ink/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type InlineRenameProps = {
  value: string;
  label: string;
  /** Called once with the trimmed name when it is non-blank and changed. */
  onCommit: (name: string) => void;
  /** Called once on Escape, or when a blank/unchanged value is committed. */
  onCancel: () => void;
};

/** Inline rename input: selects on mount; Enter/blur commit, Escape cancels. Settles exactly once. */
export function InlineRename({ value, label, onCommit, onCancel }: InlineRenameProps) {
  const ref = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  useEffect(() => ref.current?.select(), []);

  const settle = (next: string | null) => {
    if (settled.current) return;
    settled.current = true;
    const name = next?.trim();
    if (name && name !== value) onCommit(name);
    else onCancel();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      settle(e.currentTarget.value);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      settle(null);
    }
  };

  return (
    <input
      ref={ref}
      defaultValue={value}
      aria-label={label}
      onKeyDown={onKeyDown}
      onBlur={(e) => settle(e.currentTarget.value)}
      className={INPUT_CLASS}
    />
  );
}
