import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";
import { AUTH_MODES } from "@/lib/auth/modes";

const { title, description } = AUTH_MODES.signin;
export const metadata: Metadata = { title, description };

export default function SignInPage() {
  return <AuthPage mode="signin" />;
}
