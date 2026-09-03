import { AuthScreen, type AuthMode } from "@/components/auth-screen";

function safeNextPath(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/app";
  if (next.startsWith("/entrar") || next.startsWith("/api")) return "/app";
  return next;
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next, mode } = await searchParams;
  const initialMode: AuthMode =
    mode === "signup" || mode === "forgot" || mode === "reset" ? mode : "signin";

  return (
    <AuthScreen
      initialMode={initialMode}
      nextPath={safeNextPath(next)}
    />
  );
}
