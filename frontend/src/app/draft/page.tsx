import type { Metadata } from "next";
import Link from "next/link";
import { DraftCreator } from "@/components/documents/DraftCreator";
import { readCatalog, readTemplate } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Draft an Agreement",
  description: "Draft a Common Paper legal agreement by chatting with an AI assistant, and download it as a PDF.",
};

export default function DraftPage() {
  // Read synchronously so the catalog and templates are baked into the page at build time.
  const catalog = readCatalog();
  const filenames = catalog.flatMap(({ standardTerms, coverPageTemplate }) =>
    coverPageTemplate ? [standardTerms, coverPageTemplate] : [standardTerms],
  );
  const templates = Object.fromEntries(filenames.map((filename) => [filename, readTemplate(filename)]));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-8 space-y-2">
        <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
          Prelegal
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">Draft an agreement</h1>
        <p className="max-w-2xl text-brand-gray">
          Tell our AI assistant what you need. It will suggest the right{" "}
          <a href="https://commonpaper.com/standards/" target="_blank" rel="noreferrer" className="underline">
            Common Paper
          </a>{" "}
          agreement and fill it in with you, or you can edit the fields yourself. The preview
          updates as you go. Download it as a PDF when you are done.
        </p>
      </header>
      <DraftCreator catalog={catalog} templates={templates} />
    </main>
  );
}
