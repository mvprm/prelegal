import { describe, expect, it } from "vitest";
import { readTemplate } from "../templates";
import { parseDocument, type Block } from "./document";
import { escapeMarkdown } from "./markdown";

describe("parseDocument", () => {
  it("turns cover page links into defined terms", () => {
    const [paragraph] = parseDocument(
      'Use it for the <span class="coverpage_link">Purpose</span> only.',
    );

    expect(paragraph).toEqual({
      type: "paragraph",
      children: [
        { type: "text", value: "Use it for the " },
        { type: "term", children: [{ type: "text", value: "Purpose" }] },
        { type: "text", value: " only." },
      ],
    });
  });

  it("keeps the text of other spans and drops their tags", () => {
    const [paragraph] = parseDocument('<span id="4.6"></span>**"Output"** means data.');

    expect(paragraph).toEqual({
      type: "paragraph",
      children: [
        { type: "strong", children: [{ type: "text", value: '"Output"' }] },
        { type: "text", value: " means data." },
      ],
    });
  });

  it("reads task list checkboxes", () => {
    const [list] = parseDocument("- [x] Yes\n- [ ] No");

    expect(list).toMatchObject({
      type: "list",
      items: [{ checked: true }, { checked: false }],
    });
  });

  it("pads short table rows", () => {
    const [table] = parseDocument("| | A | B |\n| - | - | - |\n| Name | |");

    expect(table).toMatchObject({ type: "table" });
    expect((table as Extract<Block, { type: "table" }>).rows[0]).toHaveLength(3);
  });

  it("treats escaped user input as plain text", () => {
    const input = "**bold** <script>x</script> [link](http://evil) | # heading";
    const [paragraph] = parseDocument(escapeMarkdown(input));

    expect(paragraph).toEqual({ type: "paragraph", children: [{ type: "text", value: input }] });
  });

  it("does not turn bare URLs or emails into links", () => {
    const input = "jane@acme.com, www.acme.com and https://acme.com";
    const [paragraph] = parseDocument(escapeMarkdown(input));

    expect(paragraph).toEqual({ type: "paragraph", children: [{ type: "text", value: input }] });
  });

  it("keeps links written as link syntax", () => {
    const [paragraph] = parseDocument("[CC BY 4.0](https://cc.org) and <https://cc.org>");

    expect(paragraph).toMatchObject({
      children: [
        { type: "link", url: "https://cc.org" },
        { type: "text", value: " and " },
        { type: "link", url: "https://cc.org" },
      ],
    });
  });

  it("shows section titles in bold", () => {
    const [paragraph] = parseDocument('<span class="header_3" id="1.2">Support.</span> We help.');

    expect(paragraph).toEqual({
      type: "paragraph",
      children: [
        { type: "strong", children: [{ type: "text", value: "Support." }] },
        { type: "text", value: " We help." },
      ],
    });
  });

  it("parses the standard terms", () => {
    const standardTerms = parseDocument(readTemplate("Mutual-NDA.md"));

    const [, terms] = standardTerms;
    expect(terms).toMatchObject({ type: "list", ordered: true });
    expect((terms as Extract<Block, { type: "list" }>).items).toHaveLength(11);
    expect(JSON.stringify(standardTerms)).toContain('"type":"term"');
  });
});
