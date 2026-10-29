import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/auth/AuthGate";
import { DraftWorkspace } from "@/components/documents/DraftWorkspace";
import { PageLoading } from "@/components/ui";
import { readDraftingData } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Draft an Agreement",
  description: "Draft a Common Paper legal agreement by chatting with an AI assistant, and download it as a PDF.",
};

export default function DraftPage() {
  // Read synchronously so the catalog and templates are baked into the page at build time.
  const { catalog, templates } = readDraftingData();

  return (
    <AuthGate access="user">
      <AppShell>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <header className="mb-8 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">Draft an agreement</h1>
            <p className="max-w-2xl text-brand-gray">
              Tell our AI assistant what you need. It will suggest the right{" "}
              <a href="https://commonpaper.com/standards/" target="_blank" rel="noreferrer" className="underline">
                Common Paper
              </a>{" "}
              agreement and fill it in with you, or you can edit the fields yourself. Your draft is saved
              to My documents as you go; download it as a PDF when you are done.
            </p>
          </header>
          {/* DraftWorkspace reads ?id=, which a static export can only do inside Suspense. */}
          <Suspense fallback={<PageLoading />}>
            <DraftWorkspace catalog={catalog} templates={templates} />
          </Suspense>
        </main>
      </AppShell>
    </AuthGate>
  );
}
