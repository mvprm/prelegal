export interface Party {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export interface NdaFields {
  purpose: string;
  /** ISO date (YYYY-MM-DD), as produced by `<input type="date">`. */
  effectiveDate: string;
  mndaTerm: "expires" | "untilTerminated";
  mndaTermYears: number;
  confidentialityTerm: "years" | "perpetual";
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
}

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "" };

/** Common Paper's suggested purpose, shown on the cover page as the default. */
export const DEFAULT_PURPOSE =
  "Evaluating whether to enter into a business relationship with the other party.";

export const defaultFields: NdaFields = {
  purpose: DEFAULT_PURPOSE,
  effectiveDate: "",
  mndaTerm: "expires",
  mndaTermYears: 1,
  confidentialityTerm: "years",
  confidentialityYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty,
  party2: emptyParty,
};

const partyLabels: Record<keyof Party, string> = {
  name: "name",
  title: "title",
  company: "company",
  noticeAddress: "notice address",
};

export function isValidYears(years: number): boolean {
  return Number.isInteger(years) && years >= 1;
}

/**
 * Formats an ISO date (YYYY-MM-DD) as e.g. "October 27, 2026", or returns "" unless it is
 * a real calendar date between the years 1000 and 9999.
 */
export function formatDate(isoDate: string): string {
  const match = /^([1-9]\d{3})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls invalid days over, e.g. February 31 becomes March 3.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** e.g. "Mutual-NDA-Acme-Inc-Globex-LLC.pdf"; company names are dropped while empty. */
export function pdfFileName(fields: NdaFields): string {
  const parts = [fields.party1.company, fields.party2.company]
    .map((company) => company.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return ["Mutual-NDA", ...parts].join("-") + ".pdf";
}

/** Returns a human-readable label for each required field that is missing or invalid. */
export function missingFields(fields: NdaFields): string[] {
  const missing: string[] = [];
  if (!fields.purpose.trim()) missing.push("Purpose");
  if (!formatDate(fields.effectiveDate)) missing.push("Effective date");
  if (fields.mndaTerm === "expires" && !isValidYears(fields.mndaTermYears)) {
    missing.push("MNDA term (years)");
  }
  if (fields.confidentialityTerm === "years" && !isValidYears(fields.confidentialityYears)) {
    missing.push("Term of confidentiality (years)");
  }
  if (!fields.governingLaw.trim()) missing.push("Governing law");
  if (!fields.jurisdiction.trim()) missing.push("Jurisdiction");

  (["party1", "party2"] as const).forEach((key, index) => {
    for (const [field, label] of Object.entries(partyLabels) as [keyof Party, string][]) {
      if (!fields[key][field].trim()) missing.push(`Party ${index + 1} ${label}`);
    }
  });
  return missing;
}
