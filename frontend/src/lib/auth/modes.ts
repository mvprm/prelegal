/** The two account pages. */
export type AuthMode = "signin" | "signup";

export interface AuthModeConfig {
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  /** Link to the other account page, so users who picked the wrong one can switch. */
  switchPrompt: string;
  switchLabel: string;
  switchHref: string;
}

export const AUTH_MODES: Record<AuthMode, AuthModeConfig> = {
  signin: {
    title: "Sign in",
    description: "Welcome back. Sign in to continue drafting and to see your saved documents.",
    submitLabel: "Sign in",
    pendingLabel: "Signing in…",
    switchPrompt: "New to Prelegal?",
    switchLabel: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    description: "Draft agreements with an AI assistant. Your documents are saved to your account as you work.",
    submitLabel: "Create account",
    pendingLabel: "Creating account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/signin",
  },
};
