import { pdfFileName, type DocumentSpec, type Values } from "@/lib/documents/catalog";
import { buildCoverPage } from "@/lib/documents/coverPage";
import { parseDocument } from "@/lib/documents/document";
import { documentName } from "@/lib/documents/saved";

/**
 * Makes the document's PDF (cover page, then the Standard Terms) in the browser and saves
 * it. `templates` holds every template's markdown by filename, as the pages load it. A name
 * the user gave the document (`title`) is the PDF's title and its file name.
 */
export async function downloadDocumentPdf(
  spec: DocumentSpec,
  values: Values,
  templates: Record<string, string>,
  title: string | null,
) {
  const coverPage = parseDocument(
    buildCoverPage(spec, values, spec.coverPageTemplate && templates[spec.coverPageTemplate]),
  );
  const standardTerms = parseDocument(templates[spec.standardTerms]);
  // @react-pdf/renderer is large, so it is only loaded when someone downloads.
  const { renderDocumentPdf } = await import("./DocumentPdf");
  const pdf = await renderDocumentPdf(documentName(title, spec.name), [coverPage, standardTerms]);
  saveFile(pdf, pdfFileName(spec, values, title));
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
