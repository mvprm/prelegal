"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authRedirect, type PageAccess } from "@/lib/auth/redirect";
import { PageLoading } from "../ui";
import { useAuth } from "./AuthProvider";

/**
 * Shows its children only to the right visitors: signed-in users on "user" pages, signed-out
 * ones on "guest" pages (sign in, sign up). Everyone else is redirected; until it is known
 * who is signed in, a loading indicator is shown instead.
 */
export function AuthGate({ access, children }: { access: PageAccess; children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const target = authRedirect(status, access, window.location);
    if (target) router.replace(target);
  }, [status, access, router]);

  const allowed = status === (access === "user" ? "signedIn" : "signedOut");
  return allowed ? children : <PageLoading />;
}
