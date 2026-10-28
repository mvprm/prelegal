/**
 * The supported documents and their fields, as described by documents.json in the
 * repository root. The backend reads the same file (backend/app/documents.py) and mirrors
 * the rules below, so a change here usually needs the same change there.
 */

export type FieldType = "text" | "longtext" | "date" | "choice" | "years";

export interface FieldSpec {
  /** Key in `Values`, e.g. "governingLaw" or "party1.company". */
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Pre-filled value. For dates, "today" means the user's local date. */
  default?: string;
  description: string;
  /** For "choice" fields. */
  options?: { value: string; label: string }[];
  /** The field only applies while another field has a given value. */
  when?: { field: string; equals: string };
}

export interface DocumentSpec {
  id: string;
  name: string;
  description: string;
  /** Filename in templates/ of the Standard Terms. */
  standardTerms: string;
  /** Filename in templates/ of an official cover page to fill in; otherwise one is generated. */
  coverPageTemplate?: string;
  /** The two parties' roles, e.g. ["Provider", "Customer"]. */
  parties: [string, string];
  fields: FieldSpec[];
}

/** Every value is a string, as typed into the form; empty means not filled in. */
export type Values = Record<string, string>;

/**
 * The signature block filled in for each party, in the order of the cover page table:
 * `row` labels the table row, `label` the field (after the role, e.g. "Provider name").
 */
export const PARTY_PARTS = [
  { key: "name", row: "Print Name", label: "name", description: "Full name of the person signing" },
  { key: "title", row: "Title", label: "title", description: "The signer's job title" },
  { key: "company", row: "Company", label: "company", description: "The party's legal company name" },
  {
    key: "noticeAddress",
    row: "Notice Address",
    label: "notice address",
    description: "Email or postal address for legal notices",
  },
] as const;

export function partyFieldId(party: 1 | 2, key: (typeof PARTY_PARTS)[number]["key"]): string {
  return `party${party}.${key}`;
}

/** The party fields of a document, e.g. "party1.company" labelled "Provider company". */
export function partyFields(spec: DocumentSpec): FieldSpec[] {
  return spec.parties.flatMap((role, index) =>
    PARTY_PARTS.map(({ key, label, description }) => ({
      id: partyFieldId((index + 1) as 1 | 2, key),
      label: `${role} ${label}`,
      type: key === "noticeAddress" ? "longtext" : "text",
      required: true,
      description,
    })),
  );
}

/** The document's own fields followed by both parties' fields. */
export function allFields(spec: DocumentSpec): FieldSpec[] {
  return [...spec.fields, ...partyFields(spec)];
}

export function findDocument(catalog: DocumentSpec[], id: string | null): DocumentSpec | null {
  return catalog.find((spec) => spec.id === id) ?? null;
}

/** A new document's values: defaults filled in, everything else empty. */
export function defaultValues(spec: DocumentSpec, today: string): Values {
  return Object.fromEntries(
    allFields(spec).map((field) => [
      field.id,
      field.default === "today" ? today : (field.default ?? ""),
    ]),
  );
}

/** Whether the field applies, given the other values (see `FieldSpec.when`). */
export function isActive(field: FieldSpec, values: Values): boolean {
  return !field.when || values[field.when.field] === field.when.equals;
}

/** Whether `value` is complete and well-formed for the field. Empty is never valid. */
export function isValidValue(field: FieldSpec, value: string): boolean {
  switch (field.type) {
    case "date":
      return formatDate(value) !== "";
    case "years":
      return isValidYears(value);
    case "choice":
      return field.options?.some((option) => option.value === value) ?? false;
    default:
      return value.trim() !== "";
  }
}

/** A whole number of years, at least 1. */
export function isValidYears(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

/** Labels of the required fields that are still empty or invalid. */
export function missingFields(spec: DocumentSpec, values: Values): string[] {
  return allFields(spec)
    .filter((field) => field.required && isActive(field, values) && !isValidValue(field, values[field.id] ?? ""))
    .map((field) => field.label);
}

/** The value as it reads on the document, e.g. a formatted date or a choice's label. */
export function displayValue(field: FieldSpec, value: string): string {
  switch (field.type) {
    case "date":
      return formatDate(value);
    case "choice":
      return field.options?.find((option) => option.value === value)?.label ?? "";
    default:
      return value.trim();
  }
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

/** e.g. "Cloud-Service-Agreement-Acme-Inc-Globex-LLC.pdf"; company names are dropped while empty. */
export function pdfFileName(spec: DocumentSpec, values: Values): string {
  const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const companies = [1, 2].map((party) => slug(values[partyFieldId(party as 1 | 2, "company")] ?? ""));
  return [slug(spec.name), ...companies].filter(Boolean).join("-") + ".pdf";
}
