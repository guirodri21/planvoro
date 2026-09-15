"use client";

type AuthRequiredCardProps = {
  title: string;
  description: string;
  nextPath: string;
};

export function AuthRequiredCard({
  title,
  description,
  nextPath,
}: AuthRequiredCardProps) {
  const target = nextPath.startsWith("/") ? nextPath : "/nova";

  return (
    <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h2>{title}</h2>
      <p className="sub">{description}</p>
      <div className="auth-required-actions">
        <a href={`/entrar?next=${encodeURIComponent(target)}`} className="btn full">
          Entrar
        </a>
        <a
          href={`/entrar?mode=signup&next=${encodeURIComponent(target)}`}
          className="btn ghost full"
        >
          Criar conta
        </a>
      </div>
      <p className="tiny" style={{ marginTop: 12, marginBottom: 0 }}>
        Login por e-mail e senha via Supabase Auth.
      </p>
    </div>
  );
}
