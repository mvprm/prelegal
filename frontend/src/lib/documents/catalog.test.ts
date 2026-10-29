import { describe, expect, it } from "vitest";
import { readCatalog, readTemplate } from "../templates";
import {
  allFields,
  defaultValues,
  displayValue,
  findDocument,
  formatDate,
  isActive,
  isValidValue,
  missingFields,
  PARTY_PARTS,
  partyFieldId,
  pdfFileName,
  type DocumentSpec,
  type FieldSpec,
  type Values,
} from "./catalog";

const catalog = readCatalog();
const nda = findDocument(catalog, "mutual-nda")!;
const csa = findDocument(catalog, "cloud-service-agreement")!;
const TODAY = "2026-10-28";

const field = (overrides: Partial<FieldSpec>): FieldSpec => ({
  id: "x",
  label: "X",
  type: "text",
  required: true,
  description: "",
  ...overrides,
});

const parties = (spec: DocumentSpec): Values =>
  Object.fromEntries(allFields(spec).filter((f) => f.id.startsWith("party")).map((f) => [f.id, "x"]));

describe("documents.json", () => {
  it("covers every document in catalog.json", () => {
    const catalogJson: { filename: string }[] = JSON.parse(readTemplate("../catalog.json"));
    const used = catalog.flatMap((spec) => [spec.standardTerms, spec.coverPageTemplate ?? spec.standardTerms]);
    expect(new Set(used)).toEqual(new Set(catalogJson.map((entry) => entry.filename)));
  });

  it.each(catalog.map((spec) => [spec.name, spec] as const))(
    "has a field for every term the %s Standard Terms refer to",
    (_, spec) => {
      const known = new Set(
        [...spec.parties, ...spec.fields.map((f) => f.label), ...PARTY_PARTS.map((p) => p.row)].map(normalize),
      );
      // Variables are marked like <span class="keyterms_link">General Cap Amount</span>.
      const terms = [...readTemplate(spec.standardTerms).matchAll(/class="\w+_link"[^>]*>([^<]+)</g)].map((m) => m[1]);
      expect(terms.length).toBeGreaterThan(0);
      expect(terms.filter((term) => !known.has(normalize(term)))).toEqual([]);
    },
  );
});

/** "Customer’s Covered Claims" and "customer covered claim" both become "customer covered claim". */
function normalize(term: string): string {
  return term
    .toLowerCase()
    .replace(/[’']s?$/, "")
    .replace(/s$/, "")
    .trim();
}

describe("defaultValues", () => {
  it("fills in defaults and today's date, and leaves the rest empty", () => {
    const values = defaultValues(nda, TODAY);
    expect(values.effectiveDate).toBe(TODAY);
    expect(values.mndaTerm).toBe("expires");
    expect(values.mndaTermYears).toBe("1");
    expect(values.governingLaw).toBe("");
    expect(values[partyFieldId(2, "company")]).toBe("");
    expect(Object.keys(values)).toHaveLength(nda.fields.length + 8);
  });
});

describe("isValidValue", () => {
  it.each([
    [field({ type: "text" }), ["Delaware"], ["", "  "]],
    [field({ type: "date" }), ["2026-10-28"], ["", "2026-02-31", "20261-10-27", "0050-01-01"]],
    [field({ type: "years" }), ["1", "12"], ["", "0", "1.5", "-1"]],
    [field({ type: "choice", options: [{ value: "a", label: "A" }] }), ["a"], ["", "b"]],
  ])("checks a %o", (spec, valid, invalid) => {
    expect(valid.every((value) => isValidValue(spec, value))).toBe(true);
    expect(invalid.some((value) => isValidValue(spec, value))).toBe(false);
  });
});

describe("missingFields", () => {
  it("lists the required fields of a new NDA", () => {
    expect(missingFields(nda, defaultValues(nda, TODAY))).toEqual([
      "Governing Law",
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

  it("ignores optional fields and fields that do not apply", () => {
    const values = {
      ...defaultValues(nda, TODAY),
      ...parties(nda),
      governingLaw: "Delaware",
      jurisdiction: "courts located in New Castle, DE",
      mndaTerm: "untilTerminated",
      mndaTermYears: "",
    };
    expect(missingFields(nda, values)).toEqual([]);
    expect(missingFields(nda, { ...values, mndaTerm: "expires" })).toEqual(["MNDA Term (years)"]);
  });

  it("names parties by their role", () => {
    expect(missingFields(csa, defaultValues(csa, TODAY))).toContain("Customer notice address");
  });
});

describe("isActive", () => {
  it("applies a conditional field only while its condition holds", () => {
    const years = nda.fields.find((f) => f.id === "mndaTermYears")!;
    expect(isActive(years, { mndaTerm: "expires" })).toBe(true);
    expect(isActive(years, { mndaTerm: "untilTerminated" })).toBe(false);
  });
});

describe("displayValue", () => {
  it("shows dates and choices as they read on the document", () => {
    const term = nda.fields.find((f) => f.id === "mndaTerm")!;
    expect(displayValue(field({ type: "date" }), "2026-01-01")).toBe("January 1, 2026");
    expect(displayValue(term, "untilTerminated")).toBe("Continues until terminated");
    expect(displayValue(field({ type: "text" }), "  Delaware ")).toBe("Delaware");
  });
});

describe("formatDate", () => {
  it("formats ISO dates without time zone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
    expect(formatDate("2026-02-31")).toBe("");
  });
});

describe("pdfFileName", () => {
  it("names the file after the document and both companies", () => {
    const values = { [partyFieldId(1, "company")]: "Acme, Inc.", [partyFieldId(2, "company")]: " Globex LLC " };
    expect(pdfFileName(csa, values)).toBe("Cloud-Service-Agreement-Acme-Inc-Globex-LLC.pdf");
  });

  it("leaves out companies that are not filled in yet", () => {
    expect(pdfFileName(nda, {})).toBe("Mutual-Non-Disclosure-Agreement.pdf");
  });
});

describe("findDocument", () => {
  it("returns null for no or an unknown id", () => {
    expect(findDocument(catalog, null)).toBeNull();
    expect(findDocument(catalog, "employment-contract")).toBeNull();
  });
});
