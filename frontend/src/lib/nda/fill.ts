import { formatDate, isValidYears, type NdaFields, type Party } from "./fields";

/**
 * Fills the Common Paper Mutual NDA cover page (templates/Mutual-NDA-coverpage.md)
 * with the user's answers.
 *
 * Each placeholder must appear exactly once in the template, so a change to the upstream
 * template fails loudly instead of leaving placeholders unfilled. All placeholders are
 * located in the original template before anything is inserted, so user text can never
 * be mistaken for a placeholder. Empty answers keep the template's own placeholder text,
 * so the preview shows what is still to be filled in.
 */
export function fillCoverPage(template: string, fields: NdaFields): string {
  const expires = fields.mndaTerm === "expires";
  const forYears = fields.confidentialityTerm === "years";
  const box = (checked: boolean) => `- [${checked ? "x" : " "}]`;
  const row = (label: string, field: keyof Party) =>
    `| ${label} | ${tableCell(fields.party1[field])} | ${tableCell(fields.party2[field])} |`;

  const filled = replaceEach(template, [
    [
      "[Evaluating whether to enter into a business relationship with the other party.]",
      paragraphText(fields.purpose),
    ],
    ["[Today’s date]", escapeMarkdown(formatDate(fields.effectiveDate))],
    [
      "- [x]     Expires [1 year(s)] from Effective Date.",
      `${box(expires)}     Expires ${formatYears(fields.mndaTermYears)} from Effective Date.`,
    ],
    ["- [ ]     Continues until terminated", `${box(!expires)}     Continues until terminated`],
    [
      "- [x]     [1 year(s)] from Effective Date, but",
      `${box(forYears)}     ${formatYears(fields.confidentialityYears)} from Effective Date, but`,
    ],
    ["- [ ]     In perpetuity.", `${box(!forYears)}     In perpetuity.`],
    ["[Fill in state]", escapeMarkdown(fields.governingLaw.trim())],
    [
      "[Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      escapeMarkdown(fields.jurisdiction.trim()),
    ],
    ["List any modifications to the MNDA", paragraphText(fields.modifications) || "None."],
    ["| Print Name | |", row("Print Name", "name")],
    ["| Title | | |", row("Title", "title")],
    ["| Company | | |", row("Company", "company")],
    [
      "| Notice Address <label>Use either email or postal address</label> | | |",
      row("Notice Address", "noticeAddress"),
    ],
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

/** Backslash-escapes all ASCII punctuation so user input is always read as plain text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
}

/** Escaped text for a paragraph, keeping the user's line breaks as hard breaks. */
function paragraphText(text: string): string {
  return lines(text).map(escapeMarkdown).join("\\\n");
}

/** Escaped text for a table cell, which cannot contain line breaks. */
function tableCell(text: string): string {
  return escapeMarkdown(lines(text).join(", "));
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatYears(years: number): string {
  if (!isValidYears(years)) return "[1 year(s)]";
  return years === 1 ? "1 year" : `${years} years`;
}
