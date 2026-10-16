/** Slow-drifting mesh of three blurred blobs, fixed behind everything. Keyframes live in app.css. */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="mesh-blob mesh-blob-a" />
      <div className="mesh-blob mesh-blob-b" />
      <div className="mesh-blob mesh-blob-c" />
      <div className="mesh-grain" />
    </div>
  );
}
