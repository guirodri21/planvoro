"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { ContaMenu } from "./conta-menu";

export function AuthNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, session, loading, signOut } = useAuth();
  const nextPath = pathname === "/" ? "/app" : pathname?.startsWith("/") ? pathname : "/app";

  async function handleSignOut() {
    await signOut();
    router.refresh();
    if (pathname !== "/") router.push("/");
  }

  if (loading) {
    return (
      <div className="nav-actions nav-actions-loading" aria-hidden="true" />
    );
  }

  if (!user) {
    return (
      <div className="nav-actions">
        <a href={`/entrar?next=${encodeURIComponent(nextPath)}`} className="btn ghost sm">
          Entrar
        </a>
        <a href={`/entrar?mode=signup&next=${encodeURIComponent(nextPath)}`} className="btn sm">
          Criar conta
        </a>
      </div>
    );
  }

  return (
    <div className="nav-actions">
      <a href="/nova" className="btn sm">
        Criar viagem
      </a>
      <ContaMenu
        user={user}
        accessToken={session?.access_token ?? null}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
