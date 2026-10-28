/** Helpers for putting user text into cover page markdown, always as plain text. */

/** Backslash-escapes all ASCII punctuation so user input is always read as plain text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
}

/** Escaped text for a paragraph, keeping the user's line breaks as hard breaks. */
export function paragraphText(text: string): string {
  return lines(text).map(escapeMarkdown).join("\\\n");
}

/** Escaped text for a table cell, which cannot contain line breaks. */
export function tableCell(text: string): string {
  return escapeMarkdown(lines(text).join(", "));
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
