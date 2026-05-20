/** Atom: blinking cursor shown at the end of a live streaming response. */
export function StreamingCursor() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-0.5 bg-teal animate-pulse ml-0.5 align-middle"
    />
  );
}
