/**
 * Chrome DevTools probes this path on localhost for workspace settings. Answering with an empty 204
 * keeps "No route matches URL" out of the dev log; there is nothing to configure.
 */
export function loader() {
  return new Response(null, { status: 204 });
}
