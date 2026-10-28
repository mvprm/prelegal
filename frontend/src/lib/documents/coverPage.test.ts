import { describe, expect, it } from "vitest";
import { readCatalog, readTemplate } from "../templates";
import { defaultValues, findDocument, partyFieldId, type Values } from "./catalog";
import { buildCoverPage } from "./coverPage";
import { parseDocument } from "./document";

const catalog = readCatalog();
const csa = findDocument(catalog, "cloud-service-agreement")!;
const nda = findDocument(catalog, "mutual-nda")!;

describe("buildCoverPage", () => {
  it("fills in the official template where there is one", () => {
    const md = buildCoverPage(nda, defaultValues(nda, "2026-10-28"), readTemplate("Mutual-NDA-coverpage.md"));
    expect(md).toContain("# Mutual Non-Disclosure Agreement");
    expect(md).toContain("October 28\\, 2026");
  });

  it("needs the template for documents that have one", () => {
    expect(() => buildCoverPage(nda, {})).toThrow(/Mutual-NDA-coverpage.md/);
  });

  it("generates a cover page from the fields otherwise", () => {
    const values: Values = {
      ...defaultValues(csa, "2026-10-28"),
      subscriptionPeriod: "1 year from the Order Date",
      fees: "$1,000 per month\nInvoiced monthly",
      [partyFieldId(1, "company")]: "Acme Inc.",
      [partyFieldId(2, "name")]: "John Roe",
    };
    const md = buildCoverPage(csa, values);

    expect(md).toContain("# Cloud Service Agreement\n\n## Cover Page");
    expect(md).toContain("between Provider and Customer");
    expect(md).toContain("### Effective Date\n\nOctober 28\\, 2026");
    expect(md).toContain("### Subscription Period\n\n1 year from the Order Date");
    expect(md).toContain("### Fees\n\n\\$1\\,000 per month\\\nInvoiced monthly");
    // Required and empty: the label as a placeholder. Optional and empty: "None.".
    expect(md).toContain("### Governing Law\n\n\\[Governing Law\\]");
    expect(md).toContain("### Technical Support\n\nNone.");
    expect(md).toContain("|| PROVIDER | CUSTOMER |");
    expect(md).toContain("| Print Name |  | John Roe |");
    expect(md).toContain("| Company | Acme Inc\\. |  |");
  });

  it.each(catalog.map((spec) => [spec.name, spec] as const))("renders the %s cover page", (_, spec) => {
    const template = spec.coverPageTemplate && readTemplate(spec.coverPageTemplate);
    const blocks = parseDocument(buildCoverPage(spec, defaultValues(spec, "2026-10-28"), template));

    expect(blocks[0]).toMatchObject({ type: "heading", depth: 1 });
    expect(blocks.some((block) => block.type === "table")).toBe(true);
  });
});
