import { describe, expect, it } from "vitest";
import { defaultValues } from "@/lib/documents/catalog";
import { buildCoverPage } from "@/lib/documents/coverPage";
import { parseDocument } from "@/lib/documents/document";
import { readCatalog, readTemplate } from "@/lib/templates";
import { renderDocumentPdf } from "./DocumentPdf";

describe("renderDocumentPdf", () => {
  // Every document, since the longer Standard Terms have sections that span several pages.
  it.each(readCatalog().map((spec) => [spec.name, spec] as const))(
    "renders the %s to a PDF",
    async (_, spec) => {
      const template = spec.coverPageTemplate && readTemplate(spec.coverPageTemplate);
      const parts = [
        parseDocument(buildCoverPage(spec, defaultValues(spec, "2026-10-28"), template)),
        parseDocument(readTemplate(spec.standardTerms)),
      ];

      const blob = await renderDocumentPdf(spec.name, parts);
      const bytes = new Uint8Array(await blob.arrayBuffer());

      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(5_000);
    },
    60_000,
  );
});
