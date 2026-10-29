import { describe, expect, it } from "vitest";
import { authRedirect, safeNext } from "./redirect";

const at = (pathname: string, search = "") => ({ pathname, search });

describe("authRedirect", () => {
  it("waits while it is not yet known who is signed in", () => {
    expect(authRedirect("loading", "user", at("/draft/"))).toBeNull();
    expect(authRedirect("loading", "guest", at("/signin/"))).toBeNull();
  });

  it("shows pages to the right visitors", () => {
    expect(authRedirect("signedIn", "user", at("/"))).toBeNull();
    expect(authRedirect("signedOut", "guest", at("/signin/"))).toBeNull();
  });

  it("sends signed-out visitors to sign in, and back afterwards", () => {
    expect(authRedirect("signedOut", "user", at("/"))).toBe("/signin/");
    expect(authRedirect("signedOut", "user", at("/draft/", "?id=abc"))).toBe("/signin/?next=%2Fdraft%2F%3Fid%3Dabc");
  });

  it("sends signed-in users on from the sign in and sign up pages", () => {
    expect(authRedirect("signedIn", "guest", at("/signin/"))).toBe("/");
    expect(authRedirect("signedIn", "guest", at("/signup/", "?next=%2Fdraft%2F%3Fid%3Dabc"))).toBe("/draft/?id=abc");
  });
});

describe("safeNext", () => {
  it("allows paths on this site", () => {
    expect(safeNext("/draft/?id=abc")).toBe("/draft/?id=abc");
    expect(safeNext("/draft/?id=abc#preview")).toBe("/draft/?id=abc#preview");
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r\n/evil.example",
    "javascript:alert(1)",
  ])(
    "goes home instead of %s",
    (next) => {
      expect(safeNext(next)).toBe("/");
    },
  );
});
