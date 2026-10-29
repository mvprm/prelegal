import { pdfFileName, type DocumentSpec, type Values } from "@/lib/documents/catalog";
import { buildCoverPage } from "@/lib/documents/coverPage";
import { parseDocument } from "@/lib/documents/document";

/**
 * Makes the document's PDF (cover page, then the Standard Terms) in the browser and saves
 * it. `templates` holds every template's markdown by filename, as the pages load it.
 */
export async function downloadDocumentPdf(spec: DocumentSpec, values: Values, templates: Record<string, string>) {
  const coverPage = parseDocument(
    buildCoverPage(spec, values, spec.coverPageTemplate && templates[spec.coverPageTemplate]),
  );
  const standardTerms = parseDocument(templates[spec.standardTerms]);
  // @react-pdf/renderer is large, so it is only loaded when someone downloads.
  const { renderDocumentPdf } = await import("./DocumentPdf");
  saveFile(await renderDocumentPdf(spec.name, [coverPage, standardTerms]), pdfFileName(spec, values));
}

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
