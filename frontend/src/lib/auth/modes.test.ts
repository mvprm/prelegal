import { describe, expect, it } from "vitest";
import { AUTH_MODES } from "./modes";

describe("AUTH_MODES", () => {
  it("links each account page to the other", () => {
    expect(AUTH_MODES.signin.switchHref).toBe("/signup");
    expect(AUTH_MODES.signup.switchHref).toBe("/signin");
  });

  it("tells the user that accounts are not available yet", () => {
    for (const mode of Object.values(AUTH_MODES)) {
      expect(mode.comingSoon).toMatch(/coming soon/);
    }
  });
});
