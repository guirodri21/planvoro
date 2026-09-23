/**
 * Esqueletos de carregamento das areas logadas.
 *
 * Antes era um cartao com "Carregando..." no meio da tela. Quando os dados
 * chegavam, a pagina inteira trocava de forma — a lateral surgia, o
 * conteudo pulava para o lado — e parecia que o site tinha recarregado.
 * O esqueleto ja tem o formato final, entao so o conteudo aparece.
 */

function Bar({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <span className="sk" style={{ width: w, height: h }} />;
}

export function WorkspaceSkeleton({ label }: { label: string }) {
  return (
    <div className="app-shell ws-shell" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <aside className="ws-sidebar" aria-hidden="true">
        <div className="ws-trip">
          <Bar w="45%" h={10} />
          <Bar w="75%" h={24} />
          <Bar w="60%" />
        </div>
        <div className="ws-nav sk-nav">
          {Array.from({ length: 8 }, (_, i) => (
            <Bar key={i} w={`${60 + ((i * 13) % 30)}%`} h={16} />
          ))}
        </div>
      </aside>
      <div className="ws-content" aria-hidden="true">
        <div className="card sk-card">
          <Bar w="30%" h={22} />
          <Bar w="80%" />
          <Bar w="65%" />
        </div>
        <div className="grid2">
          <div className="card sk-card">
            <Bar w="50%" h={18} />
            <Bar />
            <Bar w="70%" />
          </div>
          <div className="card sk-card">
            <Bar w="40%" h={18} />
            <Bar />
            <Bar w="55%" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="app-shell dash-shell" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <aside className="dash-sidebar" aria-hidden="true">
        <div className="dash-hello sk-card">
          <Bar w="40%" h={10} />
          <Bar w="80%" h={24} />
        </div>
        <Bar h={44} />
        <div className="dash-stats">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="sk-card">
              <Bar w="70%" h={10} />
              <Bar w="40%" h={18} />
            </div>
          ))}
        </div>
      </aside>
      <div className="dash-main" aria-hidden="true">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="card sk-card">
            <Bar w="30%" h={22} />
            <Bar w="60%" />
            <Bar h={90} />
          </div>
        ))}
      </div>
    </div>
  );
}
