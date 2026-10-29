import { ApiError, apiRequest } from "../api";

export interface User {
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/** The password lengths the backend accepts (`MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH` in backend/app/accounts.py). */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** The longest email the backend accepts (`Credentials` in backend/app/api/auth.py). */
export const MAX_EMAIL_LENGTH = 254;

/** Creates an account and signs in to it (the backend sets the session cookie). */
export function signUp(credentials: Credentials, fetchImpl?: typeof fetch): Promise<User> {
  return apiRequest<User>("/auth/signup", { method: "POST", body: credentials, fetchImpl });
}

export function signIn(credentials: Credentials, fetchImpl?: typeof fetch): Promise<User> {
  return apiRequest<User>("/auth/signin", { method: "POST", body: credentials, fetchImpl });
}

export function signOut(fetchImpl?: typeof fetch): Promise<void> {
  return apiRequest<void>("/auth/signout", { method: "POST", fetchImpl });
}

/** The signed-in user, or null if the browser has no valid session. */
export async function fetchCurrentUser(fetchImpl?: typeof fetch): Promise<User | null> {
  try {
    return await apiRequest<User>("/auth/me", { fetchImpl });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}
