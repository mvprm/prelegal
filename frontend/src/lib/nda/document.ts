import type { BlockContent, DefinitionContent, PhrasingContent, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/**
 * A small document model covering what the Common Paper templates use. Both the HTML
 * preview and the PDF are rendered from it, so they always show the same content.
 */
export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "emphasis"; children: Inline[] }
  | { type: "link"; url: string; children: Inline[] }
  /** A reference to a cover page variable, e.g. `<span class="coverpage_link">Purpose</span>`. */
  | { type: "term"; children: Inline[] }
  | { type: "break" };

export interface ListItem {
  /** `true`/`false` for task list checkboxes, `null` for a normal list item. */
  checked: boolean | null;
  children: Block[];
}

export type Block =
  | { type: "heading"; depth: number; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] };

const processor = unified().use(remarkParse).use(remarkGfm);

export function parseDocument(markdown: string): Block[] {
  return toBlocks(processor.parse(markdown).children, markdown);
}

function toBlocks(
  nodes: (RootContent | BlockContent | DefinitionContent)[],
  source: string,
): Block[] {
  const blocks: Block[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "heading":
        blocks.push({ type: "heading", depth: node.depth, children: toInlines(node.children, source) });
        break;
      case "paragraph": {
        const children = toInlines(node.children, source);
        if (children.length > 0) blocks.push({ type: "paragraph", children });
        break;
      }
      case "list":
        blocks.push({
          type: "list",
          ordered: Boolean(node.ordered),
          start: node.start ?? 1,
          items: node.children.map((item) => ({
            checked: item.checked ?? null,
            children: toBlocks(item.children, source),
          })),
        });
        break;
      case "table": {
        const [head, ...body] = node.children.map((row) =>
          row.children.map((cell) => toInlines(cell.children, source)),
        );
        // GFM allows short rows; pad them so every row has a cell per column.
        const pad = (cells: Inline[][]) =>
          Array.from({ length: head.length }, (_, i) => cells[i] ?? []);
        blocks.push({ type: "table", header: head, rows: body.map(pad) });
        break;
      }
      // Other block types (html, code, thematic breaks, ...) do not occur in the templates.
    }
  }
  return blocks;
}

const TERM_OPEN = /^<span\b[^>]*\bclass="[^"]*_link"[^>]*>$/;

function toInlines(nodes: PhrasingContent[], source: string): Inline[] {
  const result: Inline[] = [];
  // Inline HTML arrives as separate open/close tag nodes around the text, so a stack
  // collects the children of each open <span> until its closing tag.
  const stack: { isTerm: boolean; children: Inline[] }[] = [];
  const current = () => (stack.length > 0 ? stack[stack.length - 1].children : result);

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        current().push({ type: "text", value: node.value });
        break;
      case "strong":
      case "emphasis":
        current().push({ type: node.type, children: toInlines(node.children, source) });
        break;
      case "link":
        // GFM also turns bare URLs and emails into links, including ones typed by the user.
        // Only links written as [text](url) or <url> in the template are kept as links.
        if (isLinkSyntax(node.position?.start.offset, source)) {
          current().push({ type: "link", url: node.url, children: toInlines(node.children, source) });
        } else {
          current().push(...toInlines(node.children, source));
        }
        break;
      case "break":
        current().push({ type: "break" });
        break;
      case "html":
        if (/^<span\b/.test(node.value)) {
          stack.push({ isTerm: TERM_OPEN.test(node.value), children: [] });
        } else if (node.value === "</span>" && stack.length > 0) {
          const span = stack.pop()!;
          if (span.isTerm) current().push({ type: "term", children: mergeText(span.children) });
          else current().push(...span.children);
        }
        // Any other tag is dropped; its text content is kept.
        break;
    }
  }
  // Unclosed spans: keep their content rather than losing it.
  while (stack.length > 0) {
    const span = stack.pop()!;
    current().push(...span.children);
  }
  return mergeText(result);
}

/** Joins adjacent text runs, e.g. left behind by unwrapped links or spans. */
function mergeText(inlines: Inline[]): Inline[] {
  const merged: Inline[] = [];
  for (const inline of inlines) {
    const last = merged[merged.length - 1];
    if (inline.type === "text" && last?.type === "text") {
      merged[merged.length - 1] = { type: "text", value: last.value + inline.value };
    } else {
      merged.push(inline);
    }
  }
  return merged;
}

function isLinkSyntax(offset: number | undefined, source: string): boolean {
  return offset !== undefined && (source[offset] === "[" || source[offset] === "<");
}
