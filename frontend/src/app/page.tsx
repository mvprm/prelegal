import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/auth/AuthGate";
import { MyDocuments } from "@/components/documents/MyDocuments";
import { readDraftingData } from "@/lib/templates";

export const metadata: Metadata = {
  title: "My Documents",
};

/** Home: the signed-in user's documents. Signed-out visitors are sent to sign in. */
export default function Home() {
  // The templates are needed to make PDFs straight from the list.
  const { catalog, templates } = readDraftingData();

  return (
    <AuthGate access="user">
      <AppShell>
        <MyDocuments catalog={catalog} templates={templates} />
      </AppShell>
    </AuthGate>
  );
}
