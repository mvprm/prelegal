"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import { MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/client";
import { AUTH_MODES, type AuthMode } from "@/lib/auth/modes";
import { ErrorMessage, inputClass, primaryButton } from "../ui";
import { useAuth } from "./AuthProvider";

/**
 * The sign in or sign up form. Once it succeeds, the page's AuthGate sends the user on,
 * to the page they came from (`?next=`) or home.
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const config = AUTH_MODES[mode];
  const auth = useAuth();
  const search = useSearchParams().toString();
  const emailId = useId();
  const passwordId = useId();
  const hintId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await (mode === "signup" ? auth.signUp : auth.signIn)({ email, password });
    } catch (e) {
      if (!(e instanceof ApiError)) console.error(e);
      setError(e instanceof ApiError ? e.message : GENERIC_ERROR);
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <label htmlFor={emailId} className="block text-sm font-medium text-brand-navy">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            required
            maxLength={MAX_EMAIL_LENGTH}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={passwordId} className="block text-sm font-medium text-brand-navy">
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
            maxLength={MAX_PASSWORD_LENGTH}
            aria-describedby={mode === "signup" ? hintId : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {mode === "signup" && (
            <p id={hintId} className="text-xs text-brand-gray">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
          {pending ? config.pendingLabel : config.submitLabel}
        </button>
      </form>

      <p className="text-sm text-brand-gray">
        {config.switchPrompt}{" "}
        {/* Keeps ?next=, so switching forms still returns the user where they were going. */}
        <Link href={search ? `${config.switchHref}?${search}` : config.switchHref} className="font-medium text-brand-blue hover:underline">
          {config.switchLabel}
        </Link>
      </p>
    </div>
  );
}
