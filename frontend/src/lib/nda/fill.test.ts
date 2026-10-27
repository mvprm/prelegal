import { describe, expect, it } from "vitest";
import { readTemplate } from "../templates";
import { defaultFields, formatDate, type NdaFields } from "./fields";
import { escapeMarkdown, fillCoverPage } from "./fill";

const template = readTemplate("Mutual-NDA-coverpage.md");

const completeFields: NdaFields = {
  ...defaultFields,
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-10-27",
  mndaTerm: "expires",
  mndaTermYears: 2,
  confidentialityTerm: "years",
  confidentialityYears: 3,
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "",
  party1: { name: "Jane Doe", title: "CEO", company: "Acme Inc.", noticeAddress: "jane@acme.com" },
  party2: { name: "John Roe", title: "CTO", company: "Globex LLC", noticeAddress: "john@globex.com" },
};

describe("fillCoverPage", () => {
  it("fills every placeholder in the real template", () => {
    const md = fillCoverPage(template, completeFields);

    expect(md).toContain("Exploring a joint venture\\.");
    expect(md).toContain("### Effective Date\nOctober 27\\, 2026");
    expect(md).toContain("- [x]     Expires 2 years from Effective Date.");
    expect(md).toContain("- [ ]     Continues until terminated");
    expect(md).toContain("- [x]     3 years from Effective Date, but");
    expect(md).toContain("- [ ]     In perpetuity.");
    expect(md).toContain("Governing Law: Delaware");
    expect(md).toContain("Jurisdiction: courts located in New Castle\\, DE");
    expect(md).toContain("| Print Name | Jane Doe | John Roe |");
    expect(md).toContain("| Title | CEO | CTO |");
    expect(md).toContain("| Company | Acme Inc\\. | Globex LLC |");
    expect(md).toContain("| Notice Address | jane\\@acme\\.com | john\\@globex\\.com |");
    expect(md).toContain("None.");

    expect(md).not.toMatch(/\[(Fill in|Today|1 year)/);
    expect(md).not.toContain("<label>");
  });

  it("checks the alternative term options", () => {
    const md = fillCoverPage(template, {
      ...completeFields,
      mndaTerm: "untilTerminated",
      confidentialityTerm: "perpetual",
    });

    expect(md).toContain("- [ ]     Expires 2 years from Effective Date.");
    expect(md).toContain("- [x]     Continues until terminated");
    expect(md).toContain("- [ ]     3 years from Effective Date, but");
    expect(md).toContain("- [x]     In perpetuity.");
  });

  it("uses the singular for one year", () => {
    const md = fillCoverPage(template, { ...completeFields, mndaTermYears: 1 });
    expect(md).toContain("Expires 1 year from Effective Date.");
  });

  it("keeps the template's placeholders for empty answers", () => {
    const md = fillCoverPage(template, { ...defaultFields, purpose: "" });

    expect(md).toContain(
      "[Evaluating whether to enter into a business relationship with the other party.]",
    );
    expect(md).toContain("[Today’s date]");
    expect(md).toContain("[Fill in state]");
    expect(md).toContain("[Fill in city or county and state");
    expect(md).toContain("| Print Name |  |  |");
  });

  it("keeps multi-line answers readable", () => {
    const md = fillCoverPage(template, {
      ...completeFields,
      modifications: "Section 5 is deleted.\n\nSection 9 is amended.",
      party1: { ...completeFields.party1, noticeAddress: "1 Main St\nWilmington" },
    });

    expect(md).toContain("Section 5 is deleted\\.\\\nSection 9 is amended\\.");
    expect(md).toContain("| 1 Main St\\, Wilmington |");
  });

  it("never mistakes user text for a placeholder", () => {
    const md = fillCoverPage(template, {
      ...completeFields,
      governingLaw: "List any modifications to the MNDA",
      jurisdiction: "Fill in state",
    });

    expect(md).toContain("Governing Law: List any modifications to the MNDA");
    expect(md).toContain("Jurisdiction: Fill in state");
    expect(md).toContain("### MNDA Modifications\nNone.");
  });

  it("fails loudly if the template no longer contains a placeholder", () => {
    expect(() =>
      fillCoverPage(template.replace("[Fill in state]", "[State]"), completeFields),
    ).toThrow(/\[Fill in state\]/);
  });
});

describe("escapeMarkdown", () => {
  it("escapes markdown syntax", () => {
    expect(escapeMarkdown("*a* | [b](c) <d> # 1.")).toBe(
      "\\*a\\* \\| \\[b\\]\\(c\\) \\<d\\> \\# 1\\.",
    );
  });
});

describe("formatDate", () => {
  it("formats ISO dates without time zone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
    expect(formatDate("20261-10-27")).toBe("");
    expect(formatDate("0050-01-01")).toBe("");
    expect(formatDate("2026-02-31")).toBe("");
  });
});

describe("readTemplate", () => {
  it("normalizes Windows line endings", () => {
    expect(template).not.toContain("\r");
  });
});
