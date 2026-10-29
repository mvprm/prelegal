import { formatDate, isValidYears, partyFieldId, PARTY_PARTS, type Values } from "./catalog";
import { escapeMarkdown, paragraphText, tableCell } from "./markdown";

/**
 * Fills the Common Paper Mutual NDA cover page (templates/Mutual-NDA-coverpage.md) with
 * the user's answers, using the field ids of the "mutual-nda" entry in documents.json.
 *
 * Each placeholder must appear exactly once in the template, so a change to the upstream
 * template fails loudly instead of leaving placeholders unfilled. All placeholders are
 * located in the original template before anything is inserted, so user text can never
 * be mistaken for a placeholder. Empty answers keep the template's own placeholder text,
 * so the preview shows what is still to be filled in.
 */
export function fillNdaCoverPage(template: string, values: Values): string {
  const value = (id: string) => values[id] ?? "";
  const expires = value("mndaTerm") === "expires";
  const forYears = value("confidentialityTerm") === "years";
  const box = (checked: boolean) => `- [${checked ? "x" : " "}]`;
  const rows = Object.fromEntries(
    PARTY_PARTS.map(({ key, row }) => [
      key,
      `| ${row} | ${tableCell(value(partyFieldId(1, key)))} | ${tableCell(value(partyFieldId(2, key)))} |`,
    ]),
  );

  const filled = replaceEach(template, [
    [
      "[Evaluating whether to enter into a business relationship with the other party.]",
      paragraphText(value("purpose")),
    ],
    ["[Today’s date]", escapeMarkdown(formatDate(value("effectiveDate")))],
    [
      "- [x]     Expires [1 year(s)] from Effective Date.",
      `${box(expires)}     Expires ${formatYears(value("mndaTermYears"))} from Effective Date.`,
    ],
    ["- [ ]     Continues until terminated", `${box(!expires)}     Continues until terminated`],
    [
      "- [x]     [1 year(s)] from Effective Date, but",
      `${box(forYears)}     ${formatYears(value("confidentialityYears"))} from Effective Date, but`,
    ],
    ["- [ ]     In perpetuity.", `${box(!forYears)}     In perpetuity.`],
    ["[Fill in state]", escapeMarkdown(value("governingLaw").trim())],
    [
      "[Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      escapeMarkdown(value("jurisdiction").trim()),
    ],
    ["List any modifications to the MNDA", paragraphText(value("modifications")) || "None."],
    ["| Print Name | |", rows.name],
    ["| Title | | |", rows.title],
    ["| Company | | |", rows.company],
    ["| Notice Address <label>Use either email or postal address</label> | | |", rows.noticeAddress],
  ]);

  // The remaining <label> elements are hints for whoever fills in the form. User text
  // cannot match, since escaping turns its "<" into "\<".
  return filled.replace(/<label>[^<]*<\/label>\n?/g, "");
}

/**
 * Replaces each placeholder, which must occur exactly once in `template`, with its value.
 * An empty value keeps the placeholder.
 */
function replaceEach(template: string, replacements: [string, string][]): string {
  const located = replacements
    .map(([find, value]) => {
      const index = template.indexOf(find);
      if (index === -1 || template.indexOf(find, index + 1) !== -1) {
        throw new Error(`Expected exactly one "${find}" in the Mutual NDA cover page template`);
      }
      return { index, end: index + find.length, value: value || find };
    })
    .sort((a, b) => a.index - b.index);

  let result = "";
  let position = 0;
  for (const { index, end, value } of located) {
    if (index < position) throw new Error("Overlapping placeholders in the cover page template");
    result += template.slice(position, index) + value;
    position = end;
  }
  return result + template.slice(position);
}

function formatYears(years: string): string {
  if (!isValidYears(years)) return "[1 year(s)]";
  const n = Number(years);
  return n === 1 ? "1 year" : `${n} years`;
}
