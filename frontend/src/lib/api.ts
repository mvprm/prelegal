/**
 * Requests to the backend's JSON API at /api. The frontend is served from the same origin,
 * so the session cookie goes with every request without anything extra.
 */

/** A failed request, with a message that can be shown to the user. */
export class ApiError extends Error {
  /** The HTTP status, or 0 if the backend could not be reached. */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const GENERIC_ERROR = "Sorry, something went wrong. Please try again.";
export const NETWORK_ERROR = "Could not reach Prelegal. Check your connection and try again.";

let onUnauthorized: () => void = () => {};

/**
 * Called whenever a request answers 401, i.e. the session has ended (signed out elsewhere,
 * expired, or the server restarted). The auth provider uses it to send the user to sign in.
 */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Lets the request finish after the page is closed (for a last save). */
  keepalive?: boolean;
  fetchImpl?: typeof fetch;
}

/** Sends a request to `/api{path}` and returns the JSON answer (undefined for 204). */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, keepalive, fetchImpl = fetch } = options;
  let response: Response;
  try {
    response = await fetchImpl(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    const error = await response.json().catch(() => null);
    // The backend's own errors carry a readable message; validation errors carry a list.
    throw new ApiError(response.status, typeof error?.detail === "string" ? error.detail : GENERIC_ERROR);
  }
  if (response.status === 204) return undefined as T;
  return response.json().catch(() => {
    throw new ApiError(response.status, GENERIC_ERROR);
  });
}
