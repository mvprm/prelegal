import { describe, expect, it } from "vitest";
import { readCatalog, readTemplate } from "../templates";
import { defaultValues, findDocument, type Values } from "./catalog";
import { escapeMarkdown } from "./markdown";
import { fillNdaCoverPage } from "./ndaCoverPage";

const template = readTemplate("Mutual-NDA-coverpage.md");
const nda = findDocument(readCatalog(), "mutual-nda")!;

const completeValues: Values = {
  ...defaultValues(nda, "2026-10-27"),
  purpose: "Exploring a joint venture.",
  mndaTermYears: "2",
  confidentialityYears: "3",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  "party1.name": "Jane Doe",
  "party1.title": "CEO",
  "party1.company": "Acme Inc.",
  "party1.noticeAddress": "jane@acme.com",
  "party2.name": "John Roe",
  "party2.title": "CTO",
  "party2.company": "Globex LLC",
  "party2.noticeAddress": "john@globex.com",
};

describe("fillNdaCoverPage", () => {
  it("fills every placeholder in the real template", () => {
    const md = fillNdaCoverPage(template, completeValues);

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
    const md = fillNdaCoverPage(template, {
      ...completeValues,
      mndaTerm: "untilTerminated",
      confidentialityTerm: "perpetual",
    });

    expect(md).toContain("- [ ]     Expires 2 years from Effective Date.");
    expect(md).toContain("- [x]     Continues until terminated");
    expect(md).toContain("- [ ]     3 years from Effective Date, but");
    expect(md).toContain("- [x]     In perpetuity.");
  });

  it("uses the singular for one year", () => {
    const md = fillNdaCoverPage(template, { ...completeValues, mndaTermYears: "1" });
    expect(md).toContain("Expires 1 year from Effective Date.");
  });

  it("keeps the template's placeholders for empty or invalid answers", () => {
    const md = fillNdaCoverPage(template, { mndaTerm: "expires", mndaTermYears: "1.5" });

    expect(md).toContain(
      "[Evaluating whether to enter into a business relationship with the other party.]",
    );
    expect(md).toContain("[Today’s date]");
    expect(md).toContain("Expires [1 year(s)] from Effective Date.");
    expect(md).toContain("[Fill in state]");
    expect(md).toContain("[Fill in city or county and state");
    expect(md).toContain("| Print Name |  |  |");
  });

  it("keeps multi-line answers readable", () => {
    const md = fillNdaCoverPage(template, {
      ...completeValues,
      modifications: "Section 5 is deleted.\n\nSection 9 is amended.",
      "party1.noticeAddress": "1 Main St\nWilmington",
    });

    expect(md).toContain("Section 5 is deleted\\.\\\nSection 9 is amended\\.");
    expect(md).toContain("| 1 Main St\\, Wilmington |");
  });

  it("never mistakes user text for a placeholder", () => {
    const md = fillNdaCoverPage(template, {
      ...completeValues,
      governingLaw: "List any modifications to the MNDA",
      jurisdiction: "Fill in state",
    });

    expect(md).toContain("Governing Law: List any modifications to the MNDA");
    expect(md).toContain("Jurisdiction: Fill in state");
    expect(md).toContain("### MNDA Modifications\nNone.");
  });

  it("fails loudly if the template no longer contains a placeholder", () => {
    expect(() =>
      fillNdaCoverPage(template.replace("[Fill in state]", "[State]"), completeValues),
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

describe("readTemplate", () => {
  it("normalizes Windows line endings", () => {
    expect(template).not.toContain("\r");
  });
});
