"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { userDisplayName } from "@/lib/user-name";

export function AuthNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
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
      <span className="nav-user">Oi, {userDisplayName(user)}</span>
      <a href="/app" className="btn ghost sm">
        Minhas viagens
      </a>
      <a href="/nova" className="btn sm">
        Criar viagem
      </a>
      <button type="button" className="btn ghost sm" onClick={handleSignOut}>
        Sair da conta
      </button>
    </div>
  );
}
