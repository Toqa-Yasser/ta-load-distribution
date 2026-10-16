/**
 * Focus ring for form controls, drawn inside the box: Safari clips an outside outline at the
 * horizontal edges of an `overflow: auto` ancestor (the Sheet body), so offset rings get trimmed.
 */
export const FIELD_FOCUS = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:border-transparent";

/** Shared text-input look (44px tall) for every form control in the app. */
export const INPUT_CLASS = `min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-ink transition-colors hover:border-ink/25 ${FIELD_FOCUS}`;
