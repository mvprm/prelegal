import { displayValue, isActive, partyFieldId, PARTY_PARTS, type DocumentSpec, type Values } from "./catalog";
import { escapeMarkdown, paragraphText, tableCell } from "./markdown";
import { fillNdaCoverPage } from "./ndaCoverPage";

/** Fillers for the official cover page templates, by filename (`coverPageTemplate`). */
const TEMPLATE_FILLERS: Record<string, (template: string, values: Values) => string> = {
  "Mutual-NDA-coverpage.md": fillNdaCoverPage,
};

/**
 * The document's cover page as markdown. Documents with an official cover page template
 * (`template`, the contents of `spec.coverPageTemplate`) get it filled in; the others get
 * one generated from their fields, since their templates hold only the Standard Terms.
 */
export function buildCoverPage(spec: DocumentSpec, values: Values, template?: string): string {
  if (!spec.coverPageTemplate) return generateCoverPage(spec, values);
  const fill = TEMPLATE_FILLERS[spec.coverPageTemplate];
  if (!fill) throw new Error(`No filler for the cover page template ${spec.coverPageTemplate}`);
  if (template === undefined) throw new Error(`The contents of ${spec.coverPageTemplate} are needed`);
  return fill(template, values);
}

/**
 * A cover page in the style of Common Paper's: the fields that apply, each under its label
 * (the terms the Standard Terms refer to), then the signature table. Empty required fields
 * show their label in brackets so the preview shows what is still to be filled in.
 */
function generateCoverPage(spec: DocumentSpec, values: Values): string {
  const [role1, role2] = spec.parties;
  const terms = spec.fields
    .filter((field) => isActive(field, values))
    .map((field) => {
      const shown = displayValue(field, values[field.id] ?? "");
      const text = shown ? paragraphText(shown) : field.required ? escapeMarkdown(`[${field.label}]`) : "None.";
      return `### ${field.label}\n\n${text}`;
    });
  const party = (number: 1 | 2, key: (typeof PARTY_PARTS)[number]["key"]) =>
    tableCell(values[partyFieldId(number, key)] ?? "");
  const signatures = [
    `|| ${role1.toUpperCase()} | ${role2.toUpperCase()} |`,
    "|:--- | :----: | :----: |",
    "| Signature | | |",
    ...PARTY_PARTS.map(({ key, row }) => `| ${row} | ${party(1, key)} | ${party(2, key)} |`),
    "| Date | | |",
  ].join("\n");

  return [
    `# ${spec.name}`,
    "## Cover Page",
    `This Cover Page and the Common Paper ${spec.name} Standard Terms that follow (the “Standard ` +
      `Terms”) together form the agreement between ${role1} and ${role2}. The Standard Terms are ` +
      "incorporated by reference. This Cover Page sets out the terms they refer to, including any " +
      "Key Terms and Order Form details, and controls over any conflict with the Standard Terms.",
    ...terms,
    `By signing this Cover Page, each party agrees to enter into this ${spec.name}.`,
    signatures,
    `Common Paper ${spec.name} free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`,
  ].join("\n\n");
}
