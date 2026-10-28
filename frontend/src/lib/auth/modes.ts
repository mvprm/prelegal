/** The two account pages. Accounts are not implemented yet, so both are placeholders. */
export type AuthMode = "signin" | "signup";

export interface AuthModeConfig {
  title: string;
  description: string;
  submitLabel: string;
  /** Link to the other account page, so users who picked the wrong one can switch. */
  switchPrompt: string;
  switchLabel: string;
  switchHref: string;
  /** Shown instead of submitting, until accounts exist (the backend answers 501). */
  comingSoon: string;
}

export const AUTH_MODES: Record<AuthMode, AuthModeConfig> = {
  signin: {
    title: "Sign in",
    description: "Sign in to your Prelegal account.",
    submitLabel: "Sign in",
    switchPrompt: "New to Prelegal?",
    switchLabel: "Create an account",
    switchHref: "/signup",
    comingSoon:
      "Signing in is coming soon. You can still create a Mutual NDA without an account.",
  },
  signup: {
    title: "Sign up",
    description: "Create a Prelegal account.",
    submitLabel: "Create account",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/signin",
    comingSoon:
      "Creating an account is coming soon. You can still create a Mutual NDA without an account.",
  },
};
