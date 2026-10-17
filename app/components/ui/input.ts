/**
 * Focus ring for form controls, drawn inside the box: Safari clips an outside outline at the
 * horizontal edges of an `overflow: auto` ancestor (the Sheet body), so offset rings get trimmed.
 */
export const FIELD_FOCUS =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:border-transparent aria-[invalid=true]:focus-visible:outline-danger";

/**
 * FIELD_FOCUS plus the same ring on plain :focus, for text and date fields: Safari does not match
 * :focus-visible on a clicked <input type="date">, and text fields match both anyway. Not for
 * Select, whose ring should stay keyboard-only.
 */
export const TEXT_FIELD_FOCUS = `${FIELD_FOCUS} focus:outline-2 focus:-outline-offset-2 focus:outline-accent focus:border-transparent aria-[invalid=true]:focus:outline-danger`;

/** Invalid (aria-invalid from <Field>): a danger border at rest; FIELD_FOCUS turns the ring danger while focused. */
export const FIELD_INVALID = "aria-[invalid=true]:border-danger";

/** Shared text-input look (44px tall) for every form control in the app. */
export const INPUT_CLASS = `min-h-11 w-full min-w-0 rounded-field border border-line bg-surface px-3 text-ink transition-colors hover:border-ink/25 ${FIELD_INVALID} ${TEXT_FIELD_FOCUS}`;
