import { describe, expect, it } from "vitest";
import { AUTH_MODES } from "./modes";

describe("AUTH_MODES", () => {
  it("links each account page to the other", () => {
    expect(AUTH_MODES.signin.switchHref).toBe("/signup");
    expect(AUTH_MODES.signup.switchHref).toBe("/signin");
  });

  it("no longer says accounts are coming soon", () => {
    expect(JSON.stringify(AUTH_MODES)).not.toMatch(/coming soon|Mutual NDA/i);
  });
});
