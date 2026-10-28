import type { Metadata } from "next";
import Link from "next/link";
import { NdaCreator } from "@/components/nda/NdaCreator";
import { parseDocument } from "@/lib/nda/document";
import { readTemplate } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Mutual NDA Creator",
  description: "Fill in a Common Paper Mutual NDA and download it as a PDF.",
};

export default function NdaPage() {
  // Read synchronously so the templates are baked into the page at build time.
  const coverPageTemplate = readTemplate("Mutual-NDA-coverpage.md");
  const standardTerms = parseDocument(readTemplate("Mutual-NDA.md"));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-8 space-y-2">
        <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
          Prelegal
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">Mutual NDA Creator</h1>
        <p className="max-w-2xl text-brand-gray">
          Fill in the details below to complete a Mutual Non-Disclosure Agreement based on the{" "}
          <a
            href="https://commonpaper.com/standards/mutual-nda/1.0"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Common Paper Mutual NDA
          </a>
          . The preview updates as you type. Download it as a PDF when you are done.
        </p>
      </header>
      <NdaCreator coverPageTemplate={coverPageTemplate} standardTerms={standardTerms} />
    </main>
  );
}
