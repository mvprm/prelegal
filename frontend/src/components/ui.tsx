/** Small pieces of UI shared by every page. */

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold " +
  "text-white shadow-sm transition-colors hover:bg-brand-purple/90 focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:bg-neutral-400";

/** Like `primaryButton`, in red, for actions that cannot be undone (e.g. deleting). */
export const destructiveButton =
  "inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold " +
  "text-white shadow-sm transition-colors hover:bg-red-800 focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:bg-neutral-400";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-brand-navy shadow-xs transition-colors hover:bg-neutral-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs " +
  "focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none";

/**
 * The Prelegal mark (a page with a folded corner, in the brand colours) and name.
 * `compact` drops the name on small screens.
 */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8 shrink-0">
        <rect width="32" height="32" rx="8" fill="#032147" />
        <path d="M10 7h8.5L23 11.5V24a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="#fff" />
        <path d="M18.5 7v4.5H23Z" fill="#ecad0a" />
        <path d="M12 15h8M12 18h8M12 21h5" stroke="#209dd7" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className={`text-lg ${compact ? "hidden sm:inline" : ""}`}>Prelegal</span>
    </span>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`animate-spin text-brand-blue ${className}`}>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Fills the page while something it needs is loading. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-3 py-24 text-sm text-brand-gray">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {children}
    </p>
  );
}
