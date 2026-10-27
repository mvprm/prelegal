import { describe, expect, it } from "vitest";
import { defaultFields, missingFields, pdfFileName, type NdaFields } from "./fields";

const party = { name: "Jane Doe", title: "CEO", company: "Acme Inc.", noticeAddress: "jane@acme.com" };

const completeFields: NdaFields = {
  ...defaultFields,
  effectiveDate: "2026-10-27",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  party1: party,
  party2: { ...party, company: "Globex LLC" },
};

describe("missingFields", () => {
  it("lists every required field of an empty form", () => {
    expect(missingFields({ ...defaultFields, purpose: " " })).toEqual([
      "Purpose",
      "Effective date",
      "Governing law",
      "Jurisdiction",
      "Party 1 name",
      "Party 1 title",
      "Party 1 company",
      "Party 1 notice address",
      "Party 2 name",
      "Party 2 title",
      "Party 2 company",
      "Party 2 notice address",
    ]);
  });

  it("accepts a complete form without modifications", () => {
    expect(missingFields(completeFields)).toEqual([]);
  });

  it("rejects an effective date that cannot be shown on the cover page", () => {
    expect(missingFields({ ...completeFields, effectiveDate: "20261-10-27" })).toEqual([
      "Effective date",
    ]);
  });

  it("requires a whole number of years only for the selected options", () => {
    expect(
      missingFields({ ...completeFields, mndaTermYears: Number.NaN, confidentialityYears: 1.5 }),
    ).toEqual(["MNDA term (years)", "Term of confidentiality (years)"]);

    expect(
      missingFields({
        ...completeFields,
        mndaTerm: "untilTerminated",
        mndaTermYears: Number.NaN,
        confidentialityTerm: "perpetual",
        confidentialityYears: 0,
      }),
    ).toEqual([]);
  });
});

describe("pdfFileName", () => {
  it("names the file after both companies", () => {
    expect(pdfFileName(completeFields)).toBe("Mutual-NDA-Acme-Inc-Globex-LLC.pdf");
  });

  it("falls back to a generic name", () => {
    expect(pdfFileName(defaultFields)).toBe("Mutual-NDA.pdf");
  });
});
