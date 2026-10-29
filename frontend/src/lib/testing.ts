/** Helpers for the tests. */

/** A fetch Response carrying `body` as JSON. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
