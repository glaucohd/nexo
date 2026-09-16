"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/entrar");
    router.refresh();
  }

  return <button className="signout-button" onClick={signOut}>Sair da conta</button>;
}
