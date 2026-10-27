import { describe, expect, it } from "vitest";
import { parseDocument } from "@/lib/nda/document";
import { defaultFields } from "@/lib/nda/fields";
import { fillCoverPage } from "@/lib/nda/fill";
import { readTemplate } from "@/lib/templates";
import { renderNdaPdf } from "./NdaPdf";

describe("renderNdaPdf", () => {
  it("renders the cover page and standard terms to a PDF", async () => {
    const parts = [
      parseDocument(fillCoverPage(readTemplate("Mutual-NDA-coverpage.md"), defaultFields)),
      parseDocument(readTemplate("Mutual-NDA.md")),
    ];

    const blob = await renderNdaPdf(parts);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5_000);
  }, 30_000);
});
