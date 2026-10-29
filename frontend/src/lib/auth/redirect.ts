/**
 * Where to send the user, if anywhere, before showing a page. The site is a static export,
 * so this runs in the browser once it knows whether someone is signed in; the API is what
 * actually protects the data.
 */

export type AuthStatus = "loading" | "signedIn" | "signedOut";

/** "user" pages need someone signed in; "guest" pages (sign in, sign up) need no one. */
export type PageAccess = "user" | "guest";

export const SIGN_IN_PATH = "/signin/";

/**
 * The path to redirect to, or null to show the page (or keep waiting, while loading).
 * Signed-out users go to sign in, which brings them back here afterwards via `?next=`;
 * signed-in users on the sign in and sign up pages go on to `next`, or home.
 */
export function authRedirect(status: AuthStatus, access: PageAccess, location: { pathname: string; search: string }): string | null {
  if (status === "loading") return null;
  if (access === "user" && status === "signedOut") {
    const here = location.pathname + location.search;
    return here === "/" ? SIGN_IN_PATH : `${SIGN_IN_PATH}?next=${encodeURIComponent(here)}`;
  }
  if (access === "guest" && status === "signedIn") {
    return safeNext(new URLSearchParams(location.search).get("next"));
  }
  return null;
}

/** Stands in for this site's origin when checking where a path leads. */
const SITE = "https://prelegal.invalid";

/**
 * `next` if it is a path on this site, else home, so a link cannot send users to another
 * site after they sign in. The path is resolved as a browser would, since browsers ignore
 * tabs and newlines and read `\` as `/`: "/\t/evil.com" leads to "//evil.com".
 */
export function safeNext(next: string | null): string {
  if (!next?.startsWith("/")) return "/";
  try {
    const url = new URL(next, SITE);
    return url.origin === SITE ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
