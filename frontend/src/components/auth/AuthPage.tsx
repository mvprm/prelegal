import Link from "next/link";
import { Suspense } from "react";
import { AUTH_MODES, type AuthMode } from "@/lib/auth/modes";
import { SHORT_DISCLAIMER } from "@/lib/legal";
import { Logo } from "../ui";
import { AuthForm } from "./AuthForm";
import { AuthGate } from "./AuthGate";

const HIGHLIGHTS = [
  "Tell the AI assistant what you need; it picks the right agreement and fills it in with you.",
  "Eleven Common Paper standard agreements, from NDAs to cloud service agreements.",
  "Your drafts are saved as you go. Come back to edit or download them any time.",
];

/** Shared layout of the sign in and sign up pages: the brand on one side, the form on the other. */
export function AuthPage({ mode }: { mode: AuthMode }) {
  const config = AUTH_MODES[mode];
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-brand-navy p-12 text-white lg:flex">
        <Logo className="text-white" />
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-tight">Legal agreements, drafted in minutes.</h2>
          <ul className="space-y-4 text-white/80">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-yellow" />
                {highlight}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">{SHORT_DISCLAIMER}</p>
      </aside>

      <main className="flex flex-col items-center justify-center bg-slate-50 px-4 py-16">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="text-brand-navy lg:hidden">
            <Logo />
          </Link>
          <header className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{config.title}</h1>
            <p className="text-brand-gray">{config.description}</p>
          </header>
          <AuthGate access="guest">
            {/* AuthForm reads ?next=, which a static export can only do inside Suspense. */}
            <Suspense>
              <AuthForm mode={mode} />
            </Suspense>
          </AuthGate>
        </div>
      </main>
    </div>
  );
}
