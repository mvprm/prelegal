"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { setUnauthorizedHandler } from "@/lib/api";
import * as auth from "@/lib/auth/client";
import type { Credentials, User } from "@/lib/auth/client";
import { SIGN_IN_PATH, type AuthStatus } from "@/lib/auth/redirect";

interface AuthState {
  status: AuthStatus;
  /** The signed-in user; null unless `status` is "signedIn". */
  user: User | null;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Who is signed in, for every page. It asks the backend once when the site loads, and
 * forgets the user as soon as any request answers 401 (the session ended), which sends
 * them to sign in.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  function become(next: User | null) {
    setUser(next);
    setStatus(next ? "signedIn" : "signedOut");
  }

  useEffect(() => {
    setUnauthorizedHandler(() => become(null));
    auth.fetchCurrentUser().then(become, (e) => {
      // Without an answer, assume no one is signed in; signing in will report the problem.
      console.error(e);
      become(null);
    });
  }, []);

  const value: AuthState = {
    status,
    user,
    signIn: async (credentials) => become(await auth.signIn(credentials)),
    signUp: async (credentials) => become(await auth.signUp(credentials)),
    signOut: async () => {
      await auth.signOut().catch(console.error);
      // A full page load, so nothing of this user's work stays in memory.
      window.location.replace(SIGN_IN_PATH);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}
