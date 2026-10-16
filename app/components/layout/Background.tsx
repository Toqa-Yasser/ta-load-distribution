/** Calm, flat page background: the theme's --bg plus one faint static glow at the top (.page-glow in app.css). */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="page-glow" />
    </div>
  );
}
