"use client";

import {
  use,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { DuplicateTrip } from "@/components/duplicate-trip";
import { useAuth } from "@/components/auth-provider";
import {
  DAILY_BUDGETS,
  INTERESTS,
  REACTIONS,
  RESTRICTIONS,
  type Comment,
  type Expense,
  type Idea,
  type Itinerary,
  type Item,
  type Member,
  type Preference,
  type Trip,
  type TripChecklistItem,
  type TripVaultItem,
  type Vote,
} from "@/lib/types";
import { track } from "@/lib/analytics";
import { whatsappShareUrl } from "@/lib/share";
import { userDisplayName } from "@/lib/user-name";
import {
  authHeaders,
  authJsonHeaders,
  buildPublicRouteMessage,
  buildTripInviteMessage,
  readApiJson,
} from "./_lib/api";
import {
  dateKeyFromDate,
  formatAgendaDay,
  formatDueDate,
  formatMoney,
  formatTripDate,
  isOutsideTripDates,
  pluralItens,
} from "./_lib/format";
import {
  type GenerateResponse,
  type GenerationProgress,
  type Payload,
  type WorkspaceTab,
} from "./_lib/workspace-types";
import { TravelVaultView } from "./_components/vault";
import { ExpensesView } from "./_components/expenses";
import { TravelAgentView } from "./_components/agent";
import { TripChecklistView } from "./_components/checklist";
import { IdeasView } from "./_components/ideas";
import { TravelModeView, TripAgendaView, TripMapView } from "./_components/travel-mode";



























export default function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token ?? null;
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("grupo");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  /** A ultima falha veio da geracao? So essa da para tentar de novo daqui. */
  const [falhaNaGeracao, setFalhaNaGeracao] = useState(false);

  /**
   * Falha herdada da criacao da viagem.
   *
   * O /nova cria a viagem e ja pede o roteiro. Quando esse pedido falha,
   * ele manda `?roteiro=falhou` para ca — sem isso a viagem abria muda,
   * dizendo apenas "Roteiro ainda nao gerado", que parece um passo que
   * falta e nao um erro que aconteceu.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("roteiro")) return;

    setError(
      "A primeira tentativa de gerar o roteiro não deu certo. Isso costuma ser sobrecarga momentânea do gerador — tente de novo."
    );
    setFalhaNaGeracao(true);

    // Tira o parametro da URL para o aviso nao voltar a cada recarga.
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const load = useCallback(async () => {
    setError("");
    setFalhaNaGeracao(false);

    const res = await fetch(`/api/trips/${slug}`, {
      headers: authHeaders(accessToken),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      return;
    }

    setData(json);
  }, [accessToken, slug]);

  useEffect(() => {
    setTab("grupo");
  }, [slug]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  if (error && !data) return <div className="card">{error}</div>;
  if (!data) {
    return <div className="card muted">{authLoading ? "Carregando sua conta..." : "Carregando..."}</div>;
  }

  const {
    trip,
    members,
    preferences,
    itinerary,
    votes,
    comments,
    expenses,
    vault_items,
    vault_attachments,
    checklist_items,
    ideas,
    idea_votes,
    viewer_member_id,
    trip_access,
  } =
    data;
  const locked = !trip_access?.unlocked;
  const mappedPointCount =
    itinerary?.itinerary_days.reduce(
      (sum, day) => sum + day.itinerary_items.filter((item) => item.lat && item.lng).length,
      0
    ) ?? 0;
  const me = members.find((member) => member.id === viewer_member_id) ?? null;
  const myPref = preferences.find((pref) => pref.member_id === viewer_member_id) ?? null;
  const plannedIdeaCount = ideas.filter((idea) => idea.status === "planned").length;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/v/${slug}` : `/v/${slug}`;
  const todayKey = dateKeyFromDate(new Date());
  const travelPulseCount =
    vault_items.filter((item) => item.status === "attention").length +
    checklist_items.filter(
      (item) => item.status === "open" && item.due_date && item.due_date <= todayKey
    ).length;

  async function generate() {
    if (!accessToken) {
      setError("Entre na sua conta para gerar o roteiro.");
      return;
    }

    setGenerating(true);
    setProgress(null);
    setError("");

    try {
      let completed = false;
      for (let round = 0; round < 60; round += 1) {
        const res = await fetch(`/api/trips/${slug}/generate`, {
          method: "POST",
          headers: authJsonHeaders(accessToken),
        });
        const json = await readApiJson<GenerateResponse>(res);
        if (!res.ok) {
          if (res.status === 429) track("limite_atingido", { acao: "roteiro" });
          throw new Error(json.error ?? "Não foi possível gerar o roteiro.");
        }

        if (json.dias_totais) {
          setProgress({
            diasGerados: json.dias_gerados ?? 0,
            diasTotais: json.dias_totais,
          });
        }

        setTab("roteiro");
        await load();
        if (json.concluido !== false) {
          completed = true;
          break;
        }
      }
      if (!completed) {
        throw new Error("A geração passou do limite de segurança. Reabra a viagem e tente continuar.");
      }

      setProgress(null);
      track("roteiro_gerado", { destino: trip.destination });
    } catch (e) {
      track("roteiro_falhou");
      setError(e instanceof Error ? e.message : "Erro ao gerar.");
      setFalhaNaGeracao(true);
    }

    setGenerating(false);
  }

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{trip.destination}</h1>
            <p className="sub" style={{ margin: 0 }}>
              {formatTripDate(trip.start_date)} a {formatTripDate(trip.end_date)} ·{" "}
              {trip.is_solo || trip.party_size === 1
                ? "viagem individual"
                : `${trip.party_size} pessoas`}{" "}
              ·{" "}
              {trip.budget_band ?? "orçamento livre"}
            </p>
          </div>
          <div className="avatars">
            {members.map((member) => (
              <div
                key={member.id}
                className="av"
                style={{ background: member.color }}
                title={member.name}
              >
                {member.name.slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!user ? (
        <AuthRequiredCard
          title="Entre para acessar a viagem"
          description="Agora o Planvoro usa conta para ligar você aos votos, comentários, preferências e gastos dessa viagem."
          nextPath={`/v/${slug}`}
        />
      ) : !me ? (
        <JoinCard accessToken={accessToken} slug={slug} userName={userDisplayName(user)} onJoined={load} />
      ) : (
        <>
          <WorkspaceTabs
            tab={tab}
            onChange={setTab}
            groupLabel={trip.is_solo ? "Ajustes" : "Grupo"}
            preferencesCount={preferences.length}
            memberCount={members.length}
            checklistOpenCount={checklist_items.filter((item) => item.status === "open").length}
            ideaCount={ideas.length}
            travelPulseCount={travelPulseCount}
          />

          {locked && <TripLockedNotice slug={slug} isOrganizer={Boolean(me?.is_organizer)} />}

          {tab === "grupo" && (
            <div className="group-stack">
              <TripExecutiveSummary
                trip={trip}
                members={members}
                preferences={preferences}
                itinerary={itinerary}
                ideas={ideas}
                expenses={expenses}
                vaultItems={vault_items}
                checklistItems={checklist_items}
                generating={generating}
                progress={progress}
                onGenerate={generate}
                onGoToTab={setTab}
              />
              <div className="grid2">
                <PreferencesCard
                  accessToken={accessToken}
                  slug={slug}
                  me={me}
                  pref={myPref}
                  trip={trip}
                  onSaved={load}
                />
                <PlanningCard
                  accessToken={accessToken}
                  slug={slug}
                  me={me}
                  trip={trip}
                  inviteUrl={inviteUrl}
                  members={members}
                  preferences={preferences}
                  itinerary={itinerary}
                  plannedIdeaCount={plannedIdeaCount}
                  generating={generating}
                  progress={progress}
                  onGenerate={generate}
                />
              </div>
            </div>
          )}

          {tab === "checklist" && (
            <TripChecklistView
              accessToken={accessToken}
              slug={slug}
              trip={trip}
              items={checklist_items}
              vaultItems={vault_items}
              preferences={preferences}
              members={members}
              me={me}
              locked={locked}
              onChange={load}
            />
          )}

          {tab === "ideias" && (
            <IdeasView
              accessToken={accessToken}
              ideas={ideas}
              ideaVotes={idea_votes}
              members={members}
              me={me}
              slug={slug}
              onChange={load}
              onGoToRoute={() => setTab("roteiro")}
            />
          )}

          {tab === "roteiro" &&
            (itinerary ? (
              <>
                <ItineraryView
                  accessToken={accessToken}
                  itinerary={itinerary}
                  members={members}
                  votes={votes}
                  comments={comments}
                  me={me}
                  slug={slug}
                  onChange={load}
                />
                <AfterItinerary
                  trip={trip}
                  slug={slug}
                  inviteUrl={inviteUrl}
                  accessToken={accessToken}
                  isOrganizer={Boolean(me?.is_organizer)}
                  onChange={load}
                />
              </>
            ) : (
              <div className="grid2">
                <RouteEmptyState onBackToGroup={() => setTab("grupo")} />
                <PlanningCard
                  accessToken={accessToken}
                  slug={slug}
                  me={me}
                  trip={trip}
                  inviteUrl={inviteUrl}
                  members={members}
                  preferences={preferences}
                  itinerary={itinerary}
                  plannedIdeaCount={plannedIdeaCount}
                  generating={generating}
                  progress={progress}
                  onGenerate={generate}
                />
              </div>
            ))}

          {tab === "agenda" && (
            <TripAgendaView
              trip={trip}
              itinerary={itinerary}
              vaultItems={vault_items}
              generating={generating}
              onGenerate={generate}
              onGoToRoute={() => setTab("roteiro")}
              onGoToVault={() => setTab("cofre")}
            />
          )}

          {tab === "viagem" && (
            <TravelModeView
              trip={trip}
              itinerary={itinerary}
              vaultItems={vault_items}
              checklistItems={checklist_items}
              generating={generating}
              onGenerate={generate}
              onGoToAgenda={() => setTab("agenda")}
              onGoToChecklist={() => setTab("checklist")}
              onGoToVault={() => setTab("cofre")}
            />
          )}

          {tab === "mapa" && <TripMapView itinerary={itinerary} />}

          {tab === "cofre" && (
            <TravelVaultView
              accessToken={accessToken}
              slug={slug}
              trip={trip}
              items={vault_items}
              attachments={vault_attachments}
              members={members}
              me={me}
              locked={locked}
              onChange={load}
            />
          )}

          {tab === "agente" && (
            <TravelAgentView
              accessToken={accessToken}
              slug={slug}
              trip={trip}
              members={members}
              preferences={preferences}
              itinerary={itinerary}
              ideas={ideas}
              expenses={expenses}
              vaultItems={vault_items}
              checklistItems={checklist_items}
              onChange={load}
              onOpenChecklist={() => setTab("checklist")}
            />
          )}

          {tab === "gastos" && (
            <ExpensesView
              accessToken={accessToken}
              expenses={expenses}
              members={members}
              me={me}
              slug={slug}
              trip={trip}
              locked={locked}
              onSaved={load}
            />
          )}
        </>
      )}

      {error && (
        <div className="err err-acao">
          <span>{error}</span>
          {/*
            Botao de tentar de novo, e nao so a mensagem.
            A causa mais comum e o modelo sobrecarregado, que costuma
            passar em segundos. Sem o botao, a pessoa que esperou meio
            minuto precisa procurar sozinha onde reiniciar — e a maioria
            simplesmente fecha a aba.
          */}
          {falhaNaGeracao && (
            <button className="btn sm" type="button" onClick={generate} disabled={generating}>
              {generating ? "Tentando..." : "Tentar de novo"}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function WorkspaceTabs({
  tab,
  onChange,
  groupLabel,
  preferencesCount,
  memberCount,
  checklistOpenCount,
  ideaCount,
  travelPulseCount,
}: {
  tab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  groupLabel: string;
  preferencesCount: number;
  memberCount: number;
  checklistOpenCount: number;
  ideaCount: number;
  travelPulseCount: number;
}) {
  /**
   * Abas.
   *
   * Cada aba tinha uma segunda linha com contagem — "42 dias", "150
   * marcos", "59 no mapa", "consultor ativo". Dez abas de duas linhas
   * viravam um paredao de numeros logo no topo, e nenhum deles pedia
   * acao: saber que ha 150 paradas nao muda o que a pessoa faz agora.
   *
   * Agora so aparece numero onde ele significa "tem coisa esperando por
   * voce". O resto e rotulo, e o conteudo esta a um clique.
   */
  const tabs: Array<{ id: WorkspaceTab; label: string; alerta?: number }> = [
    { id: "grupo", label: groupLabel, alerta: Math.max(0, memberCount - preferencesCount) },
    { id: "checklist", label: "Checklist", alerta: checklistOpenCount },
    { id: "ideias", label: "Ideias", alerta: ideaCount },
    { id: "roteiro", label: "Roteiro" },
    { id: "agenda", label: "Agenda" },
    { id: "mapa", label: "Mapa" },
    { id: "viagem", label: "Modo viagem", alerta: travelPulseCount },
    { id: "cofre", label: "Cofre" },
    { id: "agente", label: "Agente" },
    { id: "gastos", label: "Gastos" },
  ];

  return (
    <div className="workspace-tabs">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`tab-btn ${tab === item.id ? "on" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.alerta ? <em className="tab-alerta">{item.alerta}</em> : null}
        </button>
      ))}
    </div>
  );
}

function TripExecutiveSummary({
  trip,
  members,
  preferences,
  itinerary,
  ideas,
  expenses,
  vaultItems,
  checklistItems,
  generating,
  progress,
  onGenerate,
  onGoToTab,
}: {
  trip: Trip;
  members: Member[];
  preferences: Preference[];
  itinerary: Itinerary | null;
  ideas: Idea[];
  expenses: Expense[];
  vaultItems: TripVaultItem[];
  checklistItems: TripChecklistItem[];
  generating: boolean;
  progress: GenerationProgress | null;
  onGenerate: () => void;
  onGoToTab: (tab: WorkspaceTab) => void;
}) {
  const missingPreferences = Math.max(0, members.length - preferences.length);
  const openChecklist = checklistItems.filter((item) => item.status === "open").length;
  const doneChecklist = checklistItems.filter((item) => item.status === "done").length;
  const activeVaultItems = vaultItems.filter((item) => item.status !== "canceled");
  const attentionVault = activeVaultItems.filter((item) => item.status === "attention").length;
  const hasTravelMovement = activeVaultItems.some((item) => item.kind === "flight" || item.kind === "transport");
  const hasLodging = activeVaultItems.some((item) => item.kind === "lodging");
  const hasDocuments = activeVaultItems.some((item) => item.kind === "document" || item.kind === "visa");
  const outsideTripDates = activeVaultItems.filter((item) => isOutsideTripDates(item, trip)).length;
  const plannedIdeas = ideas.filter((idea) => idea.status === "planned").length;
  const openIdeas = ideas.filter((idea) => idea.status === "open").length;
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const paidVaultTotal = activeVaultItems.reduce(
    (sum, item) => (item.status === "paid" ? sum + Number(item.amount ?? 0) : sum),
    0
  );
  const routeDays = itinerary?.itinerary_days.length ?? 0;
  const routeItems =
    itinerary?.itinerary_days.reduce((sum, day) => sum + day.itinerary_items.length, 0) ?? 0;
  const tripStart = new Date(`${trip.start_date}T00:00:00`);
  const tripEnd = new Date(`${trip.end_date}T00:00:00`);
  const travelDays = Math.max(
    1,
    Math.round((tripEnd.getTime() - tripStart.getTime()) / 86_400_000) + 1
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToTrip = Math.ceil((tripStart.getTime() - today.getTime()) / 86_400_000);
  const timelineLabel =
    daysToTrip > 1
      ? `faltam ${daysToTrip} dias`
      : daysToTrip === 1
        ? "amanha"
        : daysToTrip === 0
          ? "começa hoje"
          : "viagem iniciada";

  const preferenceScore = members.length ? Math.round((preferences.length / members.length) * 22) : 0;
  const routeScore = itinerary ? 18 : 0;
  const checklistScore = checklistItems.length
    ? Math.round(((checklistItems.length - openChecklist) / checklistItems.length) * 18)
    : 4;
  const vaultScore = Math.round(
    ([hasTravelMovement, hasLodging, hasDocuments].filter(Boolean).length / 3) * 24
  );
  const decisionScore = itinerary || plannedIdeas ? 8 : openIdeas ? 4 : 0;
  const moneyScore = totalExpenses || paidVaultTotal ? 10 : 0;
  const readiness = Math.min(
    100,
    preferenceScore + routeScore + checklistScore + vaultScore + decisionScore + moneyScore
  );
  const readinessLabel =
    readiness >= 82
      ? "Pronta para lapidar"
      : readiness >= 58
        ? "Boa base montada"
        : "Ainda em montagem";

  const risks = [
    missingPreferences > 0 && {
      title: `${missingPreferences} pessoa${missingPreferences === 1 ? "" : "s"} sem preferências`,
      body: "Chame o grupo antes de gerar ou regerar o roteiro.",
      tab: "grupo" as WorkspaceTab,
    },
    !itinerary && {
      title: "Roteiro ainda não gerado",
      body: "Gere uma primeira versão para transformar ideias em plano.",
      tab: "roteiro" as WorkspaceTab,
    },
    openChecklist > 0 && {
      title: `${openChecklist} tarefa${openChecklist === 1 ? "" : "s"} pendente${openChecklist === 1 ? "" : "s"}`,
      body: "Resolva pendências operacionais antes de fechar reservas.",
      tab: "checklist" as WorkspaceTab,
    },
    attentionVault > 0 && {
      title: `${attentionVault} ${pluralItens(attentionVault)} do Cofre para conferir`,
      body: "Revise códigos, links, datas ou pagamentos marcados com atenção.",
      tab: "cofre" as WorkspaceTab,
    },
    !hasTravelMovement && {
      title: "Transporte principal não salvo",
      body: "Guarde voo, trem, carro ou transfer no Cofre.",
      tab: "cofre" as WorkspaceTab,
    },
    !hasLodging && {
      title: "Hospedagem não salva",
      body: "Centralize hotel ou Airbnb com endereço e check-in.",
      tab: "cofre" as WorkspaceTab,
    },
    outsideTripDates > 0 && {
      title: "Item com data fora da viagem",
      body: "Pode ser conexão, fuso ou erro de cadastro.",
      tab: "cofre" as WorkspaceTab,
    },
  ].filter(Boolean).slice(0, 5) as Array<{ title: string; body: string; tab: WorkspaceTab }>;

  /**
   * A unica acao que o resumo oferece.
   *
   * Antes eram cinco cartoes — "Ver agenda", "Modo viagem", "Resolver
   * checklist", "Organizar Cofre", "Perguntar ao agente" — que so
   * levavam para abas ja visiveis logo acima. Cinco botoes para repetir
   * uma navegacao que ja existia, e nenhum deles fazia nada por conta
   * propria.
   *
   * Gerar o roteiro e diferente: e a unica coisa que so acontece a partir
   * daqui, e o proximo passo obvio de quem ainda nao tem roteiro.
   */
  const podeGerar = !itinerary;

  return (
    <section className="trip-command-center">
      <div className="command-main">
        <h2>Resumo da viagem</h2>

        <div className="command-readiness">
          <div className="readiness-ring" style={{ "--score": readiness } as CSSProperties}>
            <strong>{readiness}%</strong>
            <span>{readinessLabel}</span>
          </div>
          <div className="command-meta">
            <div>
              <span className="stat-label">Período</span>
              <strong>
                {formatDueDate(trip.start_date)} a {formatDueDate(trip.end_date)}
              </strong>
            </div>
            <div>
              <span className="stat-label">Duração</span>
              <strong>
                {travelDays} dia{travelDays === 1 ? "" : "s"}
              </strong>
            </div>
            <div>
              <span className="stat-label">Linha do tempo</span>
              <strong>{timelineLabel}</strong>
            </div>
          </div>
        </div>

        {podeGerar && (
          <button
            type="button"
            className="btn lg command-gerar"
            onClick={onGenerate}
            disabled={generating || preferences.length === 0}
          >
            {progress
              ? `Montando ${progress.diasGerados}/${progress.diasTotais} dias`
              : generating
                ? "Gerando roteiro..."
                : preferences.length
                  ? "Gerar roteiro"
                  : "Preencha uma preferência para gerar"}
          </button>
        )}
      </div>

      <div className="command-side">
        {/*
          So o que pede acao.
          O painel "Ja encaminhado" ficava logo abaixo repetindo os mesmos
          numeros como conquista — "1 item no Cofre" aparecia como pendencia
          de um lado e como vitoria do outro, na mesma tela. Progresso ja
          esta no percentual acima; aqui fica so o que ainda falta.
        */}
        <div className="command-panel">
          <div className="command-panel-head">
            <span className="stat-label">O que pede atenção</span>
            <strong>
              {risks.length ? `${risks.length} foco${risks.length === 1 ? "" : "s"}` : "sem travas"}
            </strong>
          </div>
          {risks.length ? (
            <div className="command-risk-list">
              {risks.map((risk) => (
                <button type="button" key={risk.title} onClick={() => onGoToTab(risk.tab)}>
                  <strong>{risk.title}</strong>
                  <span>{risk.body}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="sub">
              Nada travando agora. Dá para usar o Agente para lapidar detalhes.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Aviso de viagem trancada.
 *
 * A acao muda com quem esta olhando: o organizador pode liberar, o
 * convidado nao pode e nao deve levar um botao de pagar na cara. Pedir
 * dinheiro a quem foi convidado quebraria a promessa do produto.
 */
function TripLockedNotice({ slug, isOrganizer }: { slug: string; isOrganizer: boolean }) {
  return (
    <div className="card locked-notice">
      <span className="badge b-warn">recursos do Passe</span>
      <h3>Cofre, gastos e checklist estão trancados</h3>
      <p className="sub">
        Roteiro, grupo, ideias e votacao continuam liberados. O que já foi salvo continua visivel e
        pode ser removido — nada fica preso aqui dentro.
      </p>
      {isOrganizer ? (
        <a className="btn" href={`/app?liberar=${slug}`}>
          Liberar esta viagem
        </a>
      ) : (
        <p className="tiny">
          Quem organiza a viagem pode liberar para o grupo todo. Você não precisa pagar nada.
        </p>
      )}
    </div>
  );
}








function PlanningCard({
  accessToken,
  slug,
  me,
  trip,
  inviteUrl,
  members,
  preferences,
  itinerary,
  plannedIdeaCount,
  generating,
  progress,
  onGenerate,
}: {
  accessToken: string | null;
  slug: string;
  me: Member;
  trip: Trip;
  inviteUrl: string;
  members: Member[];
  preferences: Preference[];
  itinerary: Itinerary | null;
  plannedIdeaCount: number;
  generating: boolean;
  progress: GenerationProgress | null;
  onGenerate: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState<{ sent: number; failed: number } | null>(null);
  const whatsappInviteUrl = whatsappShareUrl(buildTripInviteMessage(trip, inviteUrl, me.name));

  async function sendInvites() {
    if (!accessToken) return;

    setSendingInvites(true);
    setInviteError("");
    setInviteResult(null);

    try {
      const res = await fetch(`/api/trips/${slug}/invite-email`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ emails, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setInviteResult(json);
      setEmails("");
      setMessage("");
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Não foi possível enviar os convites.");
    }

    setSendingInvites(false);
  }

  return (
    <div className="card">
      {trip.is_solo ? (
        <>
          <h3>Seu roteiro</h3>
          <p className="sub">Marque seus interesses ao lado e gere. Leva menos de um minuto.</p>
        </>
      ) : (
        <>
          <h3>Convide o grupo</h3>
          <div className="copybox">{inviteUrl}</div>
          <div className="invite-actions">
            <a className="btn whatsapp full" href={whatsappInviteUrl} target="_blank" rel="noreferrer">
              Chamar no WhatsApp
            </a>
            <button
              className="btn ghost full"
              type="button"
              onClick={() => navigator.clipboard?.writeText(inviteUrl)}
            >
              Copiar link
            </button>
          </div>
          <p className="tiny" style={{ margin: "8px 0 0" }}>
            O WhatsApp abre com uma mensagem pronta e o link da viagem.
          </p>
          <label>Chamar por e-mail</label>
          <textarea
            rows={4}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={"ana@exemplo.com\nbruno@exemplo.com"}
          />
          <p className="tiny" style={{ margin: "8px 0 0" }}>
            Separe por quebra de linha, virgula ou ponto e virgula.
          </p>
          <label>Mensagem opcional</label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Oi! O ${me.name} já abriu a viagem no Planvoro. Entra aqui para votar e ajustar tudo com o grupo.`}
          />
          {inviteError && <div className="err">{inviteError}</div>}
          {inviteResult && (
            <div className="note" style={{ marginTop: 14 }}>
              <b>Convites enviados</b>
              <br />
              {inviteResult.sent} enviado{inviteResult.sent === 1 ? "" : "s"}
              {inviteResult.failed > 0 ? ` · ${inviteResult.failed} falhou` : ""}
            </div>
          )}
          <button
            className="btn full"
            onClick={sendInvites}
            disabled={sendingInvites || !emails.trim() || !accessToken}
          >
            {sendingInvites ? "Enviando convites..." : "Enviar convites por e-mail"}
          </button>
          <h3 style={{ marginTop: 22 }}>
            Preferencias preenchidas ({preferences.length} de {members.length})
          </h3>
          {members.map((member) => {
            const done = preferences.some((pref) => pref.member_id === member.id);
            return (
              <div className="row" key={member.id}>
                <span>
                  {member.name}
                  {member.is_organizer && <span className="badge b-ok">organizador</span>}
                </span>
                <span className={`small ${done ? "" : "muted"}`}>{done ? "pronto" : "pendente"}</span>
              </div>
            );
          })}
        </>
      )}

      <button className="btn full" onClick={onGenerate} disabled={generating || preferences.length === 0}>
        {progress
          ? `Montando roteiro: ${progress.diasGerados} de ${progress.diasTotais} dias prontos...`
          : generating
          ? "A IA esta montando o roteiro..."
          : itinerary
            ? plannedIdeaCount
              ? `Regerar com ${plannedIdeaCount} ideia${plannedIdeaCount === 1 ? "" : "s"}`
              : "Regerar roteiro"
            : trip.is_solo
              ? "Gerar meu roteiro"
              : "Gerar roteiro do grupo"}
      </button>
      {progress && (
        <p className="sub small" style={{ marginTop: 10, marginBottom: 0 }}>
          Viagens longas agora sao geradas em lotes para salvar cada parte assim que fica pronta.
        </p>
      )}
      {plannedIdeaCount > 0 && (
        <p className="sub small" style={{ marginTop: 10, marginBottom: 0 }}>
          A próxima geração vai priorizar {plannedIdeaCount} ideia
          {plannedIdeaCount === 1 ? "" : "s"} separada{plannedIdeaCount === 1 ? "" : "s"} pelo grupo.
        </p>
      )}
      {!trip.is_solo && preferences.length > 0 && preferences.length < members.length && (
        <p className="sub small" style={{ marginTop: 10, marginBottom: 0 }}>
          Da pra gerar agora, mas o roteiro fica melhor quando todo mundo preenche.
        </p>
      )}
    </div>
  );
}

function RouteEmptyState({ onBackToGroup }: { onBackToGroup: () => void }) {
  return (
    <div className="card">
      <h2>Seu roteiro ainda não existe</h2>
      <p className="sub">
        Preencha as preferencias do grupo e gere a primeira versão. Depois essa aba vira o quadro
        principal para votar, comentar e alinhar o plano.
      </p>
      <button className="btn ghost" onClick={onBackToGroup}>
        Voltar para o grupo
      </button>
    </div>
  );
}

function JoinCard({
  accessToken,
  slug,
  userName,
  onJoined,
}: {
  accessToken: string | null;
  slug: string;
  userName: string;
  onJoined: () => Promise<void> | void;
}) {
  const [name, setName] = useState(userName);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setName(userName);
  }, [userName]);

  async function join() {
    setLoading(true);
    setErr("");

    try {
      const res = await fetch(`/api/trips/${slug}/join`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      await onJoined();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <h2>Entrar na viagem</h2>
      <p className="sub">Sua conta já foi reconhecida. Falta so escolher como seu nome aparece no grupo.</p>
      <label>Seu nome no grupo</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana" />
      {err && <div className="err">{err}</div>}
      <button className="btn full" onClick={join} disabled={loading || !name.trim() || !accessToken}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </div>
  );
}

function PreferencesCard({
  accessToken,
  slug,
  me,
  pref,
  trip,
  onSaved,
}: {
  accessToken: string | null;
  slug: string;
  me: Member;
  pref: Preference | null;
  trip: Trip;
  onSaved: () => Promise<void> | void;
}) {
  const [interests, setInterests] = useState<string[]>(pref?.interests ?? []);
  const [restrictions, setRestrictions] = useState<string[]>(pref?.restrictions ?? []);
  const [budget, setBudget] = useState(pref?.daily_budget ?? DAILY_BUDGETS[1]);
  const [from, setFrom] = useState(pref?.present_from ?? trip.start_date);
  const [to, setTo] = useState(pref?.present_to ?? trip.end_date);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInterests(pref?.interests ?? []);
    setRestrictions(pref?.restrictions ?? []);
    setBudget(pref?.daily_budget ?? DAILY_BUDGETS[1]);
    setFrom(pref?.present_from ?? trip.start_date);
    setTo(pref?.present_to ?? trip.end_date);
  }, [pref, trip.end_date, trip.start_date]);

  function toggle(list: string[], set: (value: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function save() {
    setLoading(true);

    await fetch(`/api/trips/${slug}/preferences`, {
      method: "POST",
      headers: authJsonHeaders(accessToken),
      body: JSON.stringify({
        interests,
        restrictions,
        daily_budget: budget,
        present_from: from,
        present_to: to,
      }),
    });

    setLoading(false);
    setSaved(true);
    await onSaved();
  }

  return (
    <div className="card">
      <h2>Suas preferências, {me.name}</h2>
      <p className="sub">A IA usa isso para equilibrar o roteiro entre todo mundo do grupo.</p>

      <label>O que você não quer perder</label>
      <div className="chips">
        {INTERESTS.map((interest) => (
          <button
            key={interest}
            type="button"
            className={`chip ${interests.includes(interest) ? "on" : ""}`}
            onClick={() => toggle(interests, setInterests, interest)}
          >
            {interest}
          </button>
        ))}
      </div>

      <label>Restrições</label>
      <div className="chips">
        {RESTRICTIONS.map((restriction) => (
          <button
            key={restriction}
            type="button"
            className={`chip ${restrictions.includes(restriction) ? "on" : ""}`}
            onClick={() => toggle(restrictions, setRestrictions, restriction)}
          >
            {restriction}
          </button>
        ))}
      </div>

      <label>Seu orçamento por dia</label>
      <select value={budget} onChange={(e) => setBudget(e.target.value)}>
        {DAILY_BUDGETS.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>

      <div className="grid2 tight">
        <div>
          <label>Você chega em</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>Você sai em</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <button className="btn full" onClick={save} disabled={loading || !accessToken}>
        {loading ? "Salvando..." : saved ? "Salvo ✓" : "Salvar preferências"}
      </button>
    </div>
  );
}



function ItineraryView({
  accessToken,
  itinerary,
  members,
  votes,
  comments,
  me,
  slug,
  onChange,
}: {
  accessToken: string | null;
  itinerary: Itinerary;
  members: Member[];
  votes: Vote[];
  comments: Comment[];
  me: Member | null;
  slug: string;
  onChange: () => Promise<void> | void;
}) {
  return (
    <div className="card">
      <h2>Roteiro</h2>
      <p className="sub">
        Versão {itinerary.version} · reaja e comente em qualquer item para o grupo decidir junto
      </p>
      {itinerary.rationale && (
        <div className="note" style={{ marginBottom: 18 }}>
          <b>Por que ficou assim</b>
          <br />
          {itinerary.rationale}
        </div>
      )}
      {itinerary.itinerary_days.map((day) => {
        const total = day.itinerary_items.reduce((sum, item) => sum + (item.cost_estimate ?? 0), 0);
        return (
          <div className="day" key={day.id}>
            <div className="day-h">
              <b>
                {/* Era "2026-11-10" na tela, formato de banco. O cabecalho
                    da viagem, dois centimetros acima, ja mostrava
                    "10/11/2026" — a mesma data em duas linguas. */}
                {formatAgendaDay(day.day_date)}
                {day.title ? ` · ${day.title}` : ""}
              </b>
              <span className="muted">~R$ {total.toFixed(0)}/pessoa</span>
            </div>
            {day.itinerary_items.map((item) => (
              <ItemRow
                key={item.id}
                accessToken={accessToken}
                item={item}
                members={members}
                votes={votes.filter((vote) => vote.item_id === item.id)}
                comments={comments.filter((comment) => comment.item_id === item.id)}
                me={me}
                slug={slug}
                onChange={onChange}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({
  accessToken,
  item,
  members,
  votes,
  comments,
  me,
  slug,
  onChange,
}: {
  accessToken: string | null;
  item: Item;
  members: Member[];
  votes: Vote[];
  comments: Comment[];
  me: Member | null;
  slug: string;
  onChange: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(item.needs_vote);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const myVote = me ? votes.find((vote) => vote.member_id === me.id)?.value ?? null : null;
  const nameById = (id: string) => members.find((member) => member.id === id)?.name ?? "alguém";
  const colorById = (id: string) => members.find((member) => member.id === id)?.color ?? "#8B9AAD";

  async function vote(value: number) {
    if (!me || !accessToken) return;

    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/items/${item.id}/vote`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao votar.");
    }
  }

  async function comment() {
    if (!me || !text.trim() || !accessToken) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/items/${item.id}/comment`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setText("");
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao comentar.");
    }

    setSending(false);
  }

  return (
    <div className="item item-col">
      <div className="item-main">
        <div className="time">{item.start_time}</div>
        <div className="item-b">
          <div className="item-t">
            {item.title}
            {item.verified && <span className="badge b-ok">verificado</span>}
            {item.needs_vote && <span className="badge b-vote">o grupo decide</span>}
          </div>
          <div className="item-d">{item.description}</div>
        </div>
        <div className="cost">{item.cost_estimate ? `R$ ${item.cost_estimate.toFixed(0)}` : "gratis"}</div>
      </div>

      <div className="reactions">
        {REACTIONS.map((reaction) => {
          const voters = votes.filter((vote) => vote.value === reaction.value);
          const active = myVote === reaction.value;

          return (
            <button
              key={reaction.value}
              className={`react ${active ? "on" : ""}`}
              onClick={() => vote(reaction.value)}
              disabled={!me || !accessToken}
              title={
                voters.length
                  ? voters.map((vote) => nameById(vote.member_id)).join(", ")
                  : `Ninguem marcou "${reaction.label}" ainda`
              }
            >
              <span>{reaction.emoji}</span>
              {voters.length > 0 && <b>{voters.length}</b>}
            </button>
          );
        })}

        <button className="react ghost" onClick={() => setOpen((value) => !value)}>
          {comments.length > 0 ? `${comments.length} comentário${comments.length > 1 ? "s" : ""}` : "comentar"}
        </button>
      </div>

      {open && (
        <div className="thread">
          {comments.map((commentItem) => (
            <div className="cmt" key={commentItem.id}>
              <div className="av sm" style={{ background: colorById(commentItem.member_id) }}>
                {nameById(commentItem.member_id).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <b className="small">{nameById(commentItem.member_id)}</b>
                <div className="item-d">{commentItem.body}</div>
              </div>
            </div>
          ))}

          {me ? (
            <div className="cmt-form">
              <input
                value={text}
                placeholder={`Comentar como ${me.name}...`}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") comment();
                }}
              />
              <button className="btn sm" onClick={comment} disabled={sending || !text.trim() || !accessToken}>
                {sending ? "..." : "Enviar"}
              </button>
            </div>
          ) : (
            <p className="tiny" style={{ margin: 0 }}>
              Entre na viagem para comentar.
            </p>
          )}

          {error && <div className="err">{error}</div>}
        </div>
      )}
    </div>
  );
}





/**
 * O gatilho de crescimento: a pessoa acabou de ver valor sozinha.
 * E exatamente aqui que convidar o resto do grupo faz sentido pra ela --
 * e nao antes, quando ela ainda nao sabia se o produto era bom.
 */
function AfterItinerary({
  trip,
  slug,
  inviteUrl,
  accessToken,
  isOrganizer,
  onChange,
}: {
  trip: Trip;
  slug: string;
  inviteUrl: string;
  accessToken: string | null;
  isOrganizer: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : `/r/${slug}`;
  const whatsappInviteUrl = whatsappShareUrl(buildTripInviteMessage(trip, inviteUrl));
  const whatsappPublicUrl = whatsappShareUrl(buildPublicRouteMessage(trip, publicUrl));

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Publicar e despublicar o roteiro.
   *
   * Viagem de grupo nasce privada, entao sem este controle o bloco de
   * compartilhar mandava o grupo para um 404 — justamente na viagem em
   * que compartilhar faz mais sentido.
   */
  async function setPublic(next: boolean) {
    if (!accessToken || publishing) return;

    setPublishing(true);
    setPublishError("");

    try {
      const res = await fetch(`/api/trips/${slug}`, {
        method: "PATCH",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ is_public: next }),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível mudar a visibilidade.");

      await onChange();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Erro ao mudar a visibilidade.");
    } finally {
      setPublishing(false);
    }
  }

  const publish = () => setPublic(true);
  const unpublish = () => setPublic(false);

  return (
    <div className="grid2">
      {trip.is_solo && (
        <div className="card invite">
          <h3>Vai com mais alguém?</h3>
          <p className="sub">
            Mande o <b>link de convite</b> abaixo e cada pessoa marca o que quer fazer. A IA
            remonta o roteiro equilibrando o grupo inteiro — quem é vegetariano, quem odeia museu,
            quem chega depois.
          </p>
          <div className="copybox">{inviteUrl}</div>
          <div className="invite-actions">
            <a className="btn whatsapp full" href={whatsappInviteUrl} target="_blank" rel="noreferrer">
              Chamar no WhatsApp
            </a>
            <button className="btn ghost full" type="button" onClick={() => copy(inviteUrl)}>
              {copied ? "Copiado ✓" : "Copiar link"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Página pública do roteiro</h3>
        {/*
          Os dois blocos ficam lado a lado e falam de links diferentes: o de
          convite (/v/), que leva a pessoa para dentro da viagem, e o
          publico (/r/), que mostra so o roteiro sem login. Dizer "o link"
          nos dois fazia um parecer desmentir o outro — um prometia que
          cada pessoa entra e marca preferencias, o outro avisava que o
          link daria pagina nao encontrada.
        */}
        {trip.is_public ? (
          <p className="sub">
            Endereço público, sem login, para mostrar o roteiro a quem não vai viajar. Cofre,
            gastos e checklist nunca aparecem ali. É diferente do link de convite, que leva para
            dentro da viagem.
          </p>
        ) : (
          <p className="sub">
            A página pública ainda não existe, então esse endereço responde “não encontrada”.
            Publique para criá-la. O <b>link de convite</b> não depende disto e continua
            funcionando normalmente.
          </p>
        )}

        {!trip.is_public ? (
          <>
            {isOrganizer ? (
              <>
                <button
                  className="btn full"
                  type="button"
                  onClick={publish}
                  disabled={publishing || !accessToken}
                >
                  {publishing ? "Publicando..." : "Publicar roteiro"}
                </button>
                {publishError && <div className="err">{publishError}</div>}
              </>
            ) : (
              <p className="tiny">Quem organiza a viagem pode publicar o roteiro.</p>
            )}
          </>
        ) : (
          <>
        <div className="copybox">{publicUrl}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <a className="btn whatsapp full" href={whatsappPublicUrl} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <button className="btn ghost full" onClick={() => copy(publicUrl)}>
            Copiar
          </button>
          <a className="btn ghost full" href={`/r/${slug}`} target="_blank" rel="noreferrer">
            Abrir
          </a>
          <a
            className="btn ghost full"
            href={`/r/${slug}?print=1`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("roteiro_compartilhado", { canal: "pdf" })}
          >
            PDF
          </a>
        </div>

        {isOrganizer && (
          <>
            <button
              className="btn ghost sm"
              type="button"
              onClick={unpublish}
              disabled={publishing || !accessToken}
              style={{ marginTop: 10, justifySelf: "start" }}
            >
              {publishing ? "Salvando..." : "Tornar privado"}
            </button>
            {publishError && <div className="err">{publishError}</div>}
          </>
        )}
          </>
        )}

        <div className="duplicate-inline">
          <h4>Repetir esta viagem</h4>
          <p className="sub">
            Copia destino, datas e roteiro para uma viagem nova e sua. Cofre, gastos e checklist
            ficam onde estão.
          </p>
          <DuplicateTrip slug={slug} label="Duplicar viagem" />
        </div>
      </div>
    </div>
  );
}
