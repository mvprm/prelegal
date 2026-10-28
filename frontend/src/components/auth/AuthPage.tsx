import Link from "next/link";
import { AUTH_MODES, type AuthMode } from "@/lib/auth/modes";
import { AuthForm } from "./AuthForm";

/** Shared layout of the sign in and sign up pages. */
export function AuthPage({ mode }: { mode: AuthMode }) {
  const config = AUTH_MODES[mode];
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <header className="space-y-2">
        <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
          Prelegal
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{config.title}</h1>
        <p className="text-brand-gray">{config.description}</p>
      </header>
      <AuthForm mode={mode} />
    </main>
  );
}
