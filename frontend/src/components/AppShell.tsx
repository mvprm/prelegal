"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHORT_DISCLAIMER } from "@/lib/legal";
import { useAuth } from "./auth/AuthProvider";
import { Logo, primaryButton } from "./ui";

/** The frame of every signed-in page: the header with navigation and account, and the footer. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          <Link href="/" className="text-brand-navy" aria-label="Prelegal home">
            <Logo compact />
          </Link>
          <nav aria-label="Main" className="flex">
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                pathname === "/" ? "bg-slate-100 text-brand-navy" : "text-brand-gray hover:text-brand-navy"
              }`}
            >
              My documents
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link href="/draft/" className={`${primaryButton} whitespace-nowrap`}>
              New<span className="hidden sm:inline"> document</span>
            </Link>
            <span className="hidden max-w-48 truncate text-sm text-brand-gray md:inline" title={user?.email}>
              {user?.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-brand-gray hover:bg-slate-100 hover:text-brand-navy"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-brand-gray sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>{SHORT_DISCLAIMER} Have every document reviewed by a qualified lawyer before signing.</p>
          <p>
            Agreement templates by{" "}
            <a href="https://commonpaper.com/standards/" target="_blank" rel="noreferrer" className="underline hover:text-brand-navy">
              Common Paper
            </a>
            , used under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline hover:text-brand-navy">
              CC BY 4.0
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
