"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { AUTH_MODES, type AuthMode } from "@/lib/auth/modes";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs " +
  "focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none";

/**
 * Placeholder sign in / sign up form. Accounts are not implemented yet, so submitting
 * does not contact the backend; it only explains that the feature is coming soon.
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const config = AUTH_MODES[mode];
  const emailId = useId();
  const passwordId = useId();
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={emailId} className="block text-sm font-medium">
            Email
          </label>
          <input id={emailId} type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={passwordId} className="block text-sm font-medium">
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90"
        >
          {config.submitLabel}
        </button>
      </form>

      {submitted && (
        <p role="status" className="rounded-md border-l-4 border-brand-yellow bg-brand-yellow/10 px-3 py-2 text-sm text-brand-navy">
          {config.comingSoon}
        </p>
      )}

      <p className="text-sm text-brand-gray">
        {config.switchPrompt}{" "}
        <Link href={config.switchHref} className="font-medium text-brand-blue hover:underline">
          {config.switchLabel}
        </Link>
      </p>
    </div>
  );
}
