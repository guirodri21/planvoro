"use client";

import { use, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { DuplicateTrip } from "@/components/duplicate-trip";
import { TripMap } from "@/components/trip-map";
import { formatKm, suggestRoute, type GeoPoint } from "@/lib/route-order";
import { useAuth } from "@/components/auth-provider";
import {
  DAILY_BUDGETS,
  INTERESTS,
  REACTIONS,
  RESTRICTIONS,
  TRIP_CHECKLIST_CATEGORIES,
  TRIP_CHECKLIST_STATUSES,
  TRIP_VAULT_KINDS,
  TRIP_VAULT_STATUSES,
  type Comment,
  type Expense,
  type Idea,
  type IdeaStatus,
  type IdeaVote,
  type Itinerary,
  type Item,
  type Member,
  type Preference,
  type Trip,
  type TripChecklistCategory,
  type TripChecklistItem,
  type TripChecklistStatus,
  type TripVaultAttachment,
  type TripVaultItem,
  type TripVaultKind,
  type TripVaultStatus,
  type Vote,
} from "@/lib/types";
import {
  VAULT_ATTACHMENT_MAX_BYTES,
  VAULT_ATTACHMENT_MIME_TYPES,
  formatFileSize,
} from "@/lib/vault-attachments";
import { track } from "@/lib/analytics";
import { budgetTone, summarizeBudget } from "@/lib/budget";
import { buildPixPayload, detectPixKey, pixKeyLabel } from "@/lib/pix";
import { whatsappShareUrl } from "@/lib/share";
import { userDisplayName } from "@/lib/user-name";

type Payload = {
  trip: Trip;
  members: Member[];
  preferences: Preference[];
  itinerary: Itinerary | null;
  votes: Vote[];
  comments: Comment[];
  expenses: Expense[];
  vault_items: TripVaultItem[];
  vault_attachments: TripVaultAttachment[];
  checklist_items: TripChecklistItem[];
  ideas: Idea[];
  idea_votes: IdeaVote[];
  viewer_member_id: string | null;
  trip_access: { unlocked: boolean; reason: "beta" | "trip_pass" | "pro" | "locked" };
};

type WorkspaceTab =
  | "grupo"
  | "checklist"
  | "ideias"
  | "roteiro"
  | "agenda"
  | "mapa"
  | "viagem"
  | "cofre"
  | "agente"
  | "gastos";

type TravelTimelineEntry = {
  id: string;
  dayKey: string;
  sortTime: number;
  endTime: number;
  timeLabel: string;
  source: "roteiro" | "cofre";
  title: string;
  description: string | null;
  label: string;
  place: string | null;
  statusLabel: string;
  amount: number | null;
  currency?: string;
  url: string | null;
  attention: boolean;
};

type AgentReply = {
  answer: string;
  next_steps: string[];
  watchouts: string[];
};

type GenerationProgress = {
  diasGerados: number;
  diasTotais: number;
};

type GenerateResponse = {
  ok?: boolean;
  error?: string;
  concluido?: boolean;
  dias_gerados?: number;
  dias_totais?: number;
};

type VaultImportDraft = {
  kind: TripVaultKind;
  status: TripVaultStatus;
  title: string;
  provider: string | null;
  confirmation_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  amount: number | null;
  currency: string;
  url: string | null;
  notes: string | null;
  confidence: number;
  missing_fields: string[];
  summary: string;
};

type VaultImportResult = Pick<VaultImportDraft, "confidence" | "missing_fields" | "summary">;

const IDEA_CATEGORIES = [
  "Restaurante",
  "Passeio",
  "Praia",
  "Hospedagem",
  "Transporte",
  "Noite",
  "Compras",
  "Outro",
];

const AGENT_PROMPTS = [
  "O que falta decidir antes dessa viagem?",
  "Como deixar esse roteiro mais barato sem perder qualidade?",
  "O roteiro esta corrido demais? Onde voce ajustaria?",
  "Quais reservas eu deveria fazer primeiro?",
  "Que mensagem eu mando para alinhar o grupo?",
];

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const expenseDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const vaultDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const agendaDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "short",
});

const agendaTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatScore(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function formatExpenseDate(value: string) {
  return expenseDateFormatter.format(new Date(value));
}

function formatVaultDate(value: string | null) {
  if (!value) return "sem data";
  return vaultDateFormatter.format(new Date(value));
}

function formatVaultRange(item: TripVaultItem) {
  if (!item.starts_at && !item.ends_at) return "sem data";
  if (!item.ends_at) return formatVaultDate(item.starts_at);
  if (!item.starts_at) return `ate ${formatVaultDate(item.ends_at)}`;
  return `${formatVaultDate(item.starts_at)} -> ${formatVaultDate(item.ends_at)}`;
}

/** "2026-11-12T22:40" — sem Z e sem deslocamento de fuso. */
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/**
 * Valor para um input datetime-local.
 *
 * Item vindo do banco e um instante com fuso e precisa ser convertido para
 * o relogio de quem olha. Rascunho vindo da importacao ja e hora de parede
 * copiada da confirmacao — converter de novo tiraria as horas do fuso e
 * mostraria um embarque que nunca existiu.
 */
/** "2026-08-21" vira "21/08/2026". O formato ISO cru na tela e ruido. */
function formatTripDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";

  if (NAIVE_DATETIME.test(value)) return value.slice(0, 16);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function vaultKindLabel(kind: TripVaultKind) {
  return TRIP_VAULT_KINDS.find((item) => item.value === kind)?.label ?? "Outro";
}

function vaultStatusLabel(status: TripVaultStatus) {
  return TRIP_VAULT_STATUSES.find((item) => item.value === status)?.label ?? "Salvo";
}

function checklistCategoryLabel(category: TripChecklistCategory) {
  return TRIP_CHECKLIST_CATEGORIES.find((item) => item.value === category)?.label ?? "Planejamento";
}

function checklistStatusLabel(status: TripChecklistStatus) {
  return TRIP_CHECKLIST_STATUSES.find((item) => item.value === status)?.label ?? "Pendente";
}

function formatDueDate(value: string | null) {
  if (!value) return "sem prazo";
  return expenseDateFormatter.format(new Date(`${value}T00:00:00`));
}

function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return dateKeyFromDate(date);
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAgendaDay(dateKey: string) {
  return agendaDayFormatter.format(new Date(`${dateKey}T12:00:00`));
}

function formatAgendaTime(value: string | null) {
  if (!value) return "sem horario";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 5);
  return agendaTimeFormatter.format(date);
}

function buildTravelTimeline(
  trip: Trip,
  itinerary: Itinerary | null,
  vaultItems: TripVaultItem[]
): TravelTimelineEntry[] {
  const routeEntries =
    itinerary?.itinerary_days.flatMap((day) =>
      day.itinerary_items.map((item, index) => {
        const time = item.start_time?.slice(0, 5) ?? null;
        const startTime = time
          ? new Date(`${day.day_date}T${time}:00`).getTime()
          : Number.MAX_SAFE_INTEGER - 1000 + index;
        const durationMs = Math.max(30, item.duration_min ?? 90) * 60_000;

        return {
          id: `route-${item.id}`,
          dayKey: day.day_date,
          sortTime: startTime,
          endTime: startTime + durationMs,
          timeLabel: time ?? `parada ${index + 1}`,
          source: "roteiro" as const,
          title: item.title,
          description: item.description,
          label: item.category ?? "Roteiro",
          place: item.place_query,
          statusLabel: item.verified ? "verificado" : item.needs_vote ? "votacao" : "planejado",
          amount: item.cost_estimate,
          url: null,
          attention: item.needs_vote,
        };
      })
    ) ?? [];

  const vaultEntries = vaultItems
    .filter((item) => item.status !== "canceled" && (item.starts_at || item.ends_at))
    .map((item) => {
      const dateValue = item.starts_at ?? item.ends_at ?? "";
      const startTime = new Date(dateValue).getTime();
      const endTime = item.ends_at ? new Date(item.ends_at).getTime() : startTime + 60 * 60_000;

      return {
        id: `vault-${item.id}`,
        dayKey: localDateKey(dateValue),
        sortTime: startTime,
        endTime,
        timeLabel: formatAgendaTime(dateValue),
        source: "cofre" as const,
        title: item.title,
        description: item.notes,
        label: vaultKindLabel(item.kind),
        place: item.location,
        statusLabel: vaultStatusLabel(item.status),
        amount: item.amount,
        currency: item.currency,
        url: item.url,
        attention: item.status === "attention" || isOutsideTripDates(item, trip),
      };
    });

  return [...routeEntries, ...vaultEntries].sort((a, b) => a.sortTime - b.sortTime);
}

function authHeaders(accessToken: string | null) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

function authJsonHeaders(accessToken: string | null) {
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

function buildTripInviteMessage(trip: Trip, inviteUrl: string, senderName?: string) {
  const intro = senderName
    ? `${senderName} esta organizando a viagem para ${trip.destination} no Planvoro.`
    : `Estou organizando a viagem para ${trip.destination} no Planvoro.`;

  return `${intro}

Entra por esse link para preencher suas preferencias, votar nas ideias, ver o roteiro e acompanhar reservas/gastos:
${inviteUrl}`;
}

function buildPublicRouteMessage(trip: Trip, publicUrl: string) {
  return `Roteiro da viagem para ${trip.destination} no Planvoro:
${publicUrl}`;
}

async function readApiJson<T extends { error?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "O servidor respondeu em um formato inesperado."
        : "O servidor demorou demais ou retornou uma resposta inesperada. Tente gerar de novo em alguns instantes."
    );
  }
}

export default function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token ?? null;
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("grupo");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const load = useCallback(async () => {
    setError("");

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
          throw new Error(json.error ?? "Nao foi possivel gerar o roteiro.");
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
        throw new Error("A geracao passou do limite de seguranca. Reabra a viagem e tente continuar.");
      }

      setProgress(null);
      track("roteiro_gerado", { destino: trip.destination });
    } catch (e) {
      track("roteiro_falhou");
      setError(e instanceof Error ? e.message : "Erro ao gerar.");
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
              {trip.budget_band ?? "orcamento livre"}
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
          description="Agora o Planvoro usa conta para ligar voce aos votos, comentarios, preferencias e gastos dessa viagem."
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
            itineraryDays={itinerary?.itinerary_days.length ?? 0}
            timelineCount={
              (itinerary?.itinerary_days.reduce((sum, day) => sum + day.itinerary_items.length, 0) ?? 0) +
              vault_items.filter((item) => item.starts_at || item.ends_at).length
            }
            travelPulseCount={travelPulseCount}
            vaultCount={vault_items.length}
            expenseCount={expenses.length}
            mappedCount={mappedPointCount}
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
              onSaved={load}
            />
          )}
        </>
      )}

      {error && <div className="err">{error}</div>}
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
  itineraryDays,
  timelineCount,
  travelPulseCount,
  vaultCount,
  expenseCount,
  mappedCount,
}: {
  tab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  groupLabel: string;
  preferencesCount: number;
  memberCount: number;
  checklistOpenCount: number;
  ideaCount: number;
  itineraryDays: number;
  timelineCount: number;
  travelPulseCount: number;
  vaultCount: number;
  expenseCount: number;
  mappedCount: number;
}) {
  const tabs: Array<{ id: WorkspaceTab; label: string; meta: string }> = [
    { id: "grupo", label: groupLabel, meta: `${preferencesCount}/${memberCount} prontas` },
    {
      id: "checklist",
      label: "Checklist",
      meta: checklistOpenCount ? `${checklistOpenCount} pendente${checklistOpenCount === 1 ? "" : "s"}` : "em dia",
    },
    { id: "ideias", label: "Ideias", meta: ideaCount ? `${ideaCount} no quadro` : "em aberto" },
    { id: "roteiro", label: "Roteiro", meta: itineraryDays ? `${itineraryDays} dias` : "a gerar" },
    { id: "agenda", label: "Agenda", meta: timelineCount ? `${timelineCount} marcos` : "a montar" },
    { id: "mapa", label: "Mapa", meta: mappedCount ? `${mappedCount} no mapa` : "sem lugares" },
    {
      id: "viagem",
      label: "Modo viagem",
      meta: travelPulseCount ? `${travelPulseCount} alerta${travelPulseCount === 1 ? "" : "s"}` : "ao vivo",
    },
    { id: "cofre", label: "Cofre", meta: vaultCount ? `${vaultCount} salvo${vaultCount === 1 ? "" : "s"}` : "vazio" },
    { id: "agente", label: "Agente", meta: itineraryDays ? "consultor ativo" : "pre-roteiro" },
    { id: "gastos", label: "Gastos", meta: expenseCount ? `${expenseCount} lancados` : "zerado" },
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
          <small>{item.meta}</small>
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
          ? "comeca hoje"
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
      title: `${missingPreferences} pessoa${missingPreferences === 1 ? "" : "s"} sem preferencias`,
      body: "Chame o grupo antes de gerar ou regerar o roteiro.",
      tab: "grupo" as WorkspaceTab,
    },
    !itinerary && {
      title: "Roteiro ainda nao gerado",
      body: "Gere uma primeira versao para transformar ideias em plano.",
      tab: "roteiro" as WorkspaceTab,
    },
    openChecklist > 0 && {
      title: `${openChecklist} tarefa${openChecklist === 1 ? "" : "s"} pendente${openChecklist === 1 ? "" : "s"}`,
      body: "Resolva pendencias operacionais antes de fechar reservas.",
      tab: "checklist" as WorkspaceTab,
    },
    attentionVault > 0 && {
      title: `${attentionVault} item${attentionVault === 1 ? "" : "s"} do Cofre para conferir`,
      body: "Revise codigos, links, datas ou pagamentos marcados com atencao.",
      tab: "cofre" as WorkspaceTab,
    },
    !hasTravelMovement && {
      title: "Transporte principal não salvo",
      body: "Guarde voo, trem, carro ou transfer no Cofre.",
      tab: "cofre" as WorkspaceTab,
    },
    !hasLodging && {
      title: "Hospedagem nao salva",
      body: "Centralize hotel ou Airbnb com endereco e check-in.",
      tab: "cofre" as WorkspaceTab,
    },
    outsideTripDates > 0 && {
      title: "Item com data fora da viagem",
      body: "Pode ser conexao, fuso ou erro de cadastro.",
      tab: "cofre" as WorkspaceTab,
    },
  ].filter(Boolean).slice(0, 5) as Array<{ title: string; body: string; tab: WorkspaceTab }>;

  const wins = [
    itinerary && `${routeDays} dia${routeDays === 1 ? "" : "s"} de roteiro com ${routeItems} parada${routeItems === 1 ? "" : "s"}`,
    preferences.length > 0 && `${preferences.length}/${members.length} preferencia${members.length === 1 ? "" : "s"} recebida${preferences.length === 1 ? "" : "s"}`,
    activeVaultItems.length > 0 && `${activeVaultItems.length} item${activeVaultItems.length === 1 ? "" : "s"} no Cofre`,
    doneChecklist > 0 && `${doneChecklist} tarefa${doneChecklist === 1 ? "" : "s"} concluida${doneChecklist === 1 ? "" : "s"}`,
    plannedIdeas > 0 && `${plannedIdeas} ideia${plannedIdeas === 1 ? "" : "s"} aprovada${plannedIdeas === 1 ? "" : "s"}`,
    (totalExpenses > 0 || paidVaultTotal > 0) &&
      `${formatMoney(totalExpenses + paidVaultTotal)} mapeado em gastos e reservas pagas`,
  ].filter(Boolean) as string[];

  const actionCards = [
    !itinerary && {
      label: progress
        ? `Montando ${progress.diasGerados}/${progress.diasTotais} dias`
        : generating
          ? "Gerando roteiro..."
          : "Gerar roteiro",
      hint: preferences.length ? "Criar primeira versao com IA" : "Preencha ao menos uma preferencia",
      onClick: onGenerate,
      disabled: generating || preferences.length === 0,
      primary: true,
    },
    (itinerary || activeVaultItems.some((item) => item.starts_at || item.ends_at)) && {
      label: "Ver agenda",
      hint: "Roteiro e reservas por horario",
      onClick: () => onGoToTab("agenda"),
      disabled: false,
      primary: false,
    },
    (itinerary || activeVaultItems.some((item) => item.starts_at || item.ends_at)) && {
      label: "Modo viagem",
      hint: "Proximo passo, hoje e alertas",
      onClick: () => onGoToTab("viagem"),
      disabled: false,
      primary: false,
    },
    openChecklist > 0 && {
      label: "Resolver checklist",
      hint: `${openChecklist} pendencia${openChecklist === 1 ? "" : "s"} aberta${openChecklist === 1 ? "" : "s"}`,
      onClick: () => onGoToTab("checklist"),
      disabled: false,
      primary: false,
    },
    (!hasTravelMovement || !hasLodging || attentionVault > 0) && {
      label: "Organizar Cofre",
      hint: "Reservas, documentos e alertas",
      onClick: () => onGoToTab("cofre"),
      disabled: false,
      primary: false,
    },
    openIdeas > 0 && {
      label: "Decidir ideias",
      hint: `${openIdeas} ideia${openIdeas === 1 ? "" : "s"} em aberto`,
      onClick: () => onGoToTab("ideias"),
      disabled: false,
      primary: false,
    },
    {
      label: "Perguntar ao agente",
      hint: "Prioridades, riscos e próximas ações",
      onClick: () => onGoToTab("agente"),
      disabled: false,
      primary: false,
    },
    {
      label: "Ver gastos",
      hint: totalExpenses ? formatMoney(totalExpenses) : "Comecar controle financeiro",
      onClick: () => onGoToTab("gastos"),
      disabled: false,
      primary: false,
    },
  ].filter(Boolean) as Array<{
    label: string;
    hint: string;
    onClick: () => void;
    disabled: boolean;
    primary: boolean;
  }>;

  return (
    <section className="trip-command-center">
      <div className="command-main">
        <span className="badge b-ok">central de comando</span>
        <h2>Resumo executivo da viagem</h2>
        <p className="sub">
          Um painel rapido para saber se o grupo ja tem contexto suficiente, o que ainda esta solto
          e qual acao mais aproxima a viagem de ficar redonda.
        </p>
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
              <strong>{travelDays} dia{travelDays === 1 ? "" : "s"}</strong>
            </div>
            <div>
              <span className="stat-label">Linha do tempo</span>
              <strong>{timelineLabel}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="command-side">
        <div className="command-panel">
          <div className="command-panel-head">
            <span className="stat-label">O que pede atencao</span>
            <strong>{risks.length ? `${risks.length} foco${risks.length === 1 ? "" : "s"}` : "sem travas"}</strong>
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
            <p className="sub">Nada grande travando agora. Da para usar o Agente para lapidar detalhes.</p>
          )}
        </div>

        <div className="command-panel done">
          <div className="command-panel-head">
            <span className="stat-label">Ja encaminhado</span>
            <strong>{wins.length || "comecando"}</strong>
          </div>
          {wins.length ? (
            <div className="command-win-list">
              {wins.slice(0, 5).map((win) => (
                <span key={win}>{win}</span>
              ))}
            </div>
          ) : (
            <p className="sub">Preencha preferencias, gere o roteiro e guarde reservas para ver progresso aqui.</p>
          )}
        </div>
      </div>

      <div className="command-actions">
        {actionCards.slice(0, 5).map((action) => (
          <button
            type="button"
            className={`command-action ${action.primary ? "primary" : ""}`}
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            <strong>{action.label}</strong>
            <span>{action.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TravelModeView({
  trip,
  itinerary,
  vaultItems,
  checklistItems,
  generating,
  onGenerate,
  onGoToAgenda,
  onGoToChecklist,
  onGoToVault,
}: {
  trip: Trip;
  itinerary: Itinerary | null;
  vaultItems: TripVaultItem[];
  checklistItems: TripChecklistItem[];
  generating: boolean;
  onGenerate: () => void;
  onGoToAgenda: () => void;
  onGoToChecklist: () => void;
  onGoToVault: () => void;
}) {
  const now = new Date();
  const todayKey = dateKeyFromDate(now);
  const tripStart = new Date(`${trip.start_date}T00:00:00`);
  const tripEnd = new Date(`${trip.end_date}T23:59:59`);
  const entries = buildTravelTimeline(trip, itinerary, vaultItems);
  const todayEntries = entries.filter((entry) => entry.dayKey === todayKey);
  const currentEntry = entries.find((entry) => entry.sortTime <= now.getTime() && entry.endTime >= now.getTime());
  const nextEntry = entries.find((entry) => entry.sortTime > now.getTime());
  const upcomingToday = todayEntries.filter((entry) => entry.sortTime >= now.getTime()).slice(0, 5);
  const activeVaultItems = vaultItems.filter((item) => item.status !== "canceled");
  const attentionVault = activeVaultItems.filter((item) => item.status === "attention" || isOutsideTripDates(item, trip));
  const overdueChecklist = checklistItems.filter(
    (item) => item.status === "open" && item.due_date && item.due_date < todayKey
  );
  const dueTodayChecklist = checklistItems.filter(
    (item) => item.status === "open" && item.due_date === todayKey
  );
  const openChecklist = checklistItems.filter((item) => item.status === "open");
  const undatedVault = activeVaultItems.filter((item) => !item.starts_at && !item.ends_at);
  const daysToTrip = Math.ceil((tripStart.getTime() - now.getTime()) / 86_400_000);
  const isDuringTrip = now >= tripStart && now <= tripEnd;
  const isAfterTrip = now > tripEnd;
  const heroTitle = isDuringTrip
    ? "Modo viagem ligado"
    : isAfterTrip
      ? "Viagem concluida, hora de fechar a organizacao"
      : daysToTrip <= 1
        ? "Pre-embarque final"
        : "Sala de preparo da viagem";
  const heroSubtitle = isDuringTrip
    ? "Acompanhe o que esta acontecendo agora, o que vem em seguida e qualquer alerta operacional."
    : isAfterTrip
      ? "Revise gastos, guarde comprovantes finais e use o historico como memoria da viagem."
      : "Use esta tela como checklist vivo antes de embarcar: reservas, horarios, documentos e pendencias.";
  const statusLabel = isDuringTrip
    ? "em andamento"
    : isAfterTrip
      ? "pos-viagem"
      : daysToTrip > 1
        ? `faltam ${daysToTrip} dias`
        : daysToTrip === 1
          ? "amanha"
          : "comeca hoje";
  const focusEntry = currentEntry ?? nextEntry;
  const firstChecklist = overdueChecklist[0] ?? dueTodayChecklist[0] ?? openChecklist[0] ?? null;
  const alerts = [
    ...overdueChecklist.slice(0, 3).map((item) => ({
      title: item.title,
      body: `Checklist atrasado · ${checklistCategoryLabel(item.category)}`,
      action: onGoToChecklist,
    })),
    ...dueTodayChecklist.slice(0, 3).map((item) => ({
      title: item.title,
      body: `Para hoje · ${checklistCategoryLabel(item.category)}`,
      action: onGoToChecklist,
    })),
    ...attentionVault.slice(0, 4).map((item) => ({
      title: item.title,
      body: `${vaultKindLabel(item.kind)} · ${vaultStatusLabel(item.status)}`,
      action: onGoToVault,
    })),
    ...undatedVault.slice(0, 2).map((item) => ({
      title: item.title,
      body: "No Cofre, mas sem data ou horario",
      action: onGoToVault,
    })),
  ].slice(0, 6);

  return (
    <div className="travel-mode-shell">
      <section className="travel-mode-hero">
        <div className="travel-mode-map">
          <span className="travel-pulse" />
          <span className="travel-route-line" />
          <span className="travel-dot d1" />
          <span className="travel-dot d2" />
          <span className="travel-dot d3" />
        </div>
        <div className="travel-mode-copy">
          <span className="badge b-ok">modo viagem</span>
          <h2>{heroTitle}</h2>
          <p>{heroSubtitle}</p>
          <div className="travel-mode-actions">
            {!itinerary && (
              <button className="btn" type="button" onClick={onGenerate} disabled={generating}>
                {generating ? "Gerando..." : "Gerar roteiro"}
              </button>
            )}
            <button className="btn ghost" type="button" onClick={onGoToAgenda}>
              Abrir agenda completa
            </button>
            <button className="btn ghost" type="button" onClick={onGoToVault}>
              Ver reservas
            </button>
          </div>
        </div>
        <div className="travel-mode-status-card">
          <span className="stat-label">Status da viagem</span>
          <strong>{statusLabel}</strong>
          <small>
            {entries.length
              ? `${entries.length} marco${entries.length === 1 ? "" : "s"} entre roteiro e cofre`
              : "Sem agenda montada ainda"}
          </small>
        </div>
      </section>

      <div className="travel-mode-grid">
        <div className="card travel-now-card">
          <span className="stat-label">{currentEntry ? "Acontecendo agora" : "Proximo passo"}</span>
          {focusEntry ? (
            <>
              <h3>{focusEntry.title}</h3>
              <p className="sub">
                {focusEntry.timeLabel} · {formatAgendaDay(focusEntry.dayKey)} ·{" "}
                {focusEntry.source === "cofre" ? "Cofre" : "Roteiro"}
              </p>
              <div className="travel-now-meta">
                <span>{focusEntry.label}</span>
                <span>{focusEntry.statusLabel}</span>
                {focusEntry.place && <span>{focusEntry.place}</span>}
                {focusEntry.amount != null && (
                  <span>
                    {focusEntry.currency
                      ? `${focusEntry.currency} ${Number(focusEntry.amount).toFixed(2)}`
                      : formatMoney(Number(focusEntry.amount))}
                  </span>
                )}
              </div>
              {focusEntry.description && <p className="item-d">{focusEntry.description}</p>}
              {focusEntry.url && (
                <a className="btn ghost sm" href={focusEntry.url} target="_blank" rel="noreferrer">
                  Abrir link salvo
                </a>
              )}
            </>
          ) : (
            <>
              <h3>Nenhum compromisso com horario ainda</h3>
              <p className="sub">
                Adicione horarios no Cofre ou gere um roteiro para esta tela virar o copiloto do dia.
              </p>
              <button className="btn ghost" type="button" onClick={onGoToVault}>
                Guardar reserva no Cofre
              </button>
            </>
          )}
        </div>

        <div className="card travel-next-card">
          <span className="stat-label">Hoje</span>
          <h3>{todayEntries.length ? `${todayEntries.length} marco${todayEntries.length === 1 ? "" : "s"}` : "Dia livre"}</h3>
          {upcomingToday.length ? (
            <div className="travel-mini-timeline">
              {upcomingToday.map((entry) => (
                <button type="button" key={entry.id} onClick={onGoToAgenda}>
                  <strong>{entry.timeLabel}</strong>
                  <span>{entry.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="sub">
              {todayEntries.length
                ? "Os marcos de hoje ja passaram. Se ainda estiver na rua, confira a agenda completa."
                : "Nada datado para hoje. Bom para explorar, descansar ou completar pendencias."}
            </p>
          )}
        </div>

        <div className="card travel-alert-card">
          <div className="travel-card-head">
            <div>
              <span className="stat-label">Radar de campo</span>
              <h3>{alerts.length ? `${alerts.length} alerta${alerts.length === 1 ? "" : "s"}` : "Tudo calmo"}</h3>
            </div>
            <button className="btn ghost sm" type="button" onClick={onGoToChecklist}>
              Checklist
            </button>
          </div>
          {alerts.length ? (
            <div className="travel-alert-list">
              {alerts.map((alert) => (
                <button type="button" key={`${alert.title}-${alert.body}`} onClick={alert.action}>
                  <strong>{alert.title}</strong>
                  <span>{alert.body}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="sub">Sem checklist atrasado e sem reserva marcada para conferir. O raro sabor da ordem.</p>
          )}
        </div>

        <div className="card travel-quick-card">
          <span className="stat-label">Atalhos uteis</span>
          <h3>Se algo apertar</h3>
          <div className="travel-quick-grid">
            <button type="button" onClick={onGoToVault}>
              <strong>Reservas</strong>
              <span>voo, hotel, codigos e links</span>
            </button>
            <button type="button" onClick={onGoToAgenda}>
              <strong>Agenda</strong>
              <span>dia por dia em ordem</span>
            </button>
            <button type="button" onClick={onGoToChecklist}>
              <strong>Pendencias</strong>
              <span>{firstChecklist ? firstChecklist.title : "nada urgente agora"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripAgendaView({
  trip,
  itinerary,
  vaultItems,
  generating,
  onGenerate,
  onGoToRoute,
  onGoToVault,
}: {
  trip: Trip;
  itinerary: Itinerary | null;
  vaultItems: TripVaultItem[];
  generating: boolean;
  onGenerate: () => void;
  onGoToRoute: () => void;
  onGoToVault: () => void;
}) {
  const activeVaultItems = vaultItems.filter((item) => item.status !== "canceled");
  const entries = buildTravelTimeline(trip, itinerary, vaultItems);
  const routeEntryCount = entries.filter((entry) => entry.source === "roteiro").length;
  const dayKeys = Array.from(new Set(entries.map((entry) => entry.dayKey))).sort();
  const undatedVault = activeVaultItems.filter((item) => !item.starts_at && !item.ends_at);
  const outsideTripDates = activeVaultItems.filter((item) => isOutsideTripDates(item, trip)).length;
  const attentionVault = activeVaultItems.filter((item) => item.status === "attention").length;
  const routeDays = itinerary?.itinerary_days.length ?? 0;

  const radar = [
    !itinerary && "Roteiro ainda nao foi gerado.",
    activeVaultItems.length > 0 &&
      undatedVault.length > 0 &&
      `${undatedVault.length} item${undatedVault.length === 1 ? "" : "s"} do Cofre sem data ou horario.`,
    outsideTripDates > 0 &&
      `${outsideTripDates} item${outsideTripDates === 1 ? "" : "s"} com data fora do periodo da viagem.`,
    attentionVault > 0 &&
      `${attentionVault} item${attentionVault === 1 ? "" : "s"} marcado${attentionVault === 1 ? "" : "s"} para conferir.`,
    entries.length > 0 && routeEntryCount === 0 && "A Agenda ainda depende so do Cofre; gere o roteiro para ver os passeios.",
  ].filter(Boolean) as string[];

  return (
    <div className="agenda-shell">
      <div className="card agenda-hero">
        <div>
          <span className="badge b-ok">linha do tempo</span>
          <h2>Agenda da viagem</h2>
          <p className="sub">
            Roteiro, voos, hospedagens, reservas e documentos datados no mesmo lugar. O objetivo e
            enxergar a viagem como ela vai acontecer, dia por dia.
          </p>
        </div>
        <div className="agenda-hero-actions">
          {!itinerary && (
            <button className="btn" type="button" onClick={onGenerate} disabled={generating}>
              {generating ? "Gerando..." : "Gerar roteiro"}
            </button>
          )}
          <button className="btn ghost" type="button" onClick={onGoToRoute}>
            Abrir roteiro
          </button>
          <button className="btn ghost" type="button" onClick={onGoToVault}>
            Abrir Cofre
          </button>
        </div>

        <div className="agenda-stats">
          <div>
            <span className="stat-label">Dias roteirizados</span>
            <strong>{routeDays || "a gerar"}</strong>
          </div>
          <div>
            <span className="stat-label">Marcos na agenda</span>
            <strong>{entries.length}</strong>
          </div>
          <div>
            <span className="stat-label">Cofre sem horario</span>
            <strong>{undatedVault.length}</strong>
          </div>
          <div>
            <span className="stat-label">Alertas</span>
            <strong>{radar.length}</strong>
          </div>
        </div>
      </div>

      <div className="agenda-layout">
        <div className="agenda-days">
          {entries.length === 0 ? (
            <div className="card agenda-empty">
              <h3>A linha do tempo ainda esta vazia</h3>
              <p className="sub">
                Gere o roteiro ou adicione datas nos itens do Cofre para a Agenda virar o painel
                cronologico da viagem.
              </p>
              <div className="agenda-empty-actions">
                <button className="btn" type="button" onClick={onGenerate} disabled={generating}>
                  {generating ? "Gerando roteiro..." : "Gerar roteiro"}
                </button>
                <button className="btn ghost" type="button" onClick={onGoToVault}>
                  Guardar reserva no Cofre
                </button>
              </div>
            </div>
          ) : (
            dayKeys.map((dayKey) => {
              const dayEntries = entries.filter((entry) => entry.dayKey === dayKey);
              return (
                <div className="agenda-day-card" key={dayKey}>
                  <div className="agenda-day-head">
                    <div>
                      <span className="stat-label">Dia da viagem</span>
                      <h3>{formatAgendaDay(dayKey)}</h3>
                    </div>
                    <span className="badge b-ok">
                      {dayEntries.length} marco{dayEntries.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="agenda-entry-list">
                    {dayEntries.map((entry) => (
                      <div className={`agenda-entry ${entry.source} ${entry.attention ? "attention" : ""}`} key={entry.id}>
                        <div className="agenda-time">
                          <strong>{entry.timeLabel}</strong>
                          <span>{entry.source === "roteiro" ? "roteiro" : "cofre"}</span>
                        </div>
                        <div className="agenda-entry-body">
                          <div className="agenda-entry-head">
                            <div>
                              <span className="stat-label">{entry.label}</span>
                              <h4>{entry.title}</h4>
                            </div>
                            <span className={`badge ${entry.attention ? "b-warn" : "b-ok"}`}>
                              {entry.statusLabel}
                            </span>
                          </div>
                          {entry.description && <p className="item-d">{entry.description}</p>}
                          <div className="agenda-entry-meta">
                            {entry.place && <span>{entry.place}</span>}
                            {entry.amount != null && (
                              <span>
                                {"currency" in entry
                                  ? `${entry.currency} ${Number(entry.amount).toFixed(2)}`
                                  : formatMoney(Number(entry.amount))}
                              </span>
                            )}
                            {entry.url && (
                              <a href={entry.url} target="_blank" rel="noreferrer">
                                Abrir link
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside className="agenda-side">
          <div className="card agenda-radar">
            <span className="badge b-warn">radar</span>
            <h3>O que observar</h3>
            {radar.length ? (
              <div className="agenda-radar-list">
                {radar.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : (
              <p className="sub">Agenda sem alertas obvios agora. Bom sinal, capitão.</p>
            )}
          </div>

          <div className="card agenda-radar">
            <span className="badge b-ok">sem data</span>
            <h3>Cofre ainda solto</h3>
            {undatedVault.length ? (
              <div className="agenda-loose-list">
                {undatedVault.slice(0, 6).map((item) => (
                  <button type="button" key={item.id} onClick={onGoToVault}>
                    <strong>{item.title}</strong>
                    <span>
                      {vaultKindLabel(item.kind)} · {vaultStatusLabel(item.status)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="sub">Tudo que esta ativo no Cofre ja tem data ou horario.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TripChecklistView({
  accessToken,
  slug,
  trip,
  items,
  vaultItems,
  preferences,
  members,
  onChange,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  items: TripChecklistItem[];
  vaultItems: TripVaultItem[];
  preferences: Preference[];
  members: Member[];
  onChange: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    title: "",
    category: "planning" as TripChecklistCategory,
    due_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  const openItems = items.filter((item) => item.status === "open");
  const doneItems = items.filter((item) => item.status === "done");
  const progress = items.length ? Math.round((doneItems.length / items.length) * 100) : 0;
  const statusOrder: Record<TripChecklistStatus, number> = { open: 0, done: 1, skipped: 2 };
  const sortedItems = [...items].sort((a, b) => {
    const byStatus = statusOrder[a.status] - statusOrder[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return b.created_at.localeCompare(a.created_at);
  });

  const hasVaultKind = (kinds: TripVaultKind[]) =>
    vaultItems.some((item) => kinds.includes(item.kind) && item.status !== "canceled");
  const hasExistingTask = (title: string) =>
    items.some((item) => item.title.toLowerCase() === title.toLowerCase());

  const suggestions = [
    !hasVaultKind(["flight", "transport"]) && {
      title: "Guardar passagens ou transporte de chegada no Cofre",
      category: "transport" as TripChecklistCategory,
      notes: "Salve localizador, horarios, terminal/aeroporto e link da reserva.",
    },
    !hasVaultKind(["lodging"]) && {
      title: "Guardar hospedagem no Cofre",
      category: "booking" as TripChecklistCategory,
      notes: "Inclua endereco, check-in, check-out, codigo da reserva e regras de cancelamento.",
    },
    !hasVaultKind(["insurance"]) && {
      title: "Conferir seguro viagem",
      category: "health" as TripChecklistCategory,
      notes: "Guarde apolice, contato de emergencia e cobertura principal.",
    },
    !hasVaultKind(["document", "visa"]) && {
      title: "Conferir documentos e requisitos de entrada",
      category: "documents" as TripChecklistCategory,
      notes: "Verifique passaporte, visto, vacinas, autorizações e comprovantes necessarios.",
    },
    preferences.length < members.length && {
      title: "Chamar quem ainda nao preencheu preferencias",
      category: "group" as TripChecklistCategory,
      notes: `${members.length - preferences.length} pessoa(s) ainda faltam preencher preferencias.`,
    },
    vaultItems.some((item) => item.status === "attention") && {
      title: "Resolver itens marcados como precisa conferir",
      category: "planning" as TripChecklistCategory,
      notes: "Revise o Cofre e atualize status, codigos ou links pendentes.",
    },
  ].filter((item): item is { title: string; category: TripChecklistCategory; notes: string } =>
    Boolean(item && !hasExistingTask(item.title))
  );

  function updateForm(next: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...next }));
  }

  async function createItem(input?: {
    title: string;
    category: TripChecklistCategory;
    notes?: string;
    due_date?: string;
    source?: "manual" | "suggested";
  }) {
    if (!accessToken || saving) return;

    const payload = input ?? { ...form, source: "manual" as const };
    if (!payload.title.trim()) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify(payload),
      });
      const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel salvar a tarefa.");

      if (!input) {
        setForm({ title: "", category: "planning", due_date: "", notes: "" });
      }
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar tarefa.");
    } finally {
      setSaving(false);
    }
  }

  async function setItemStatus(itemId: string, status: TripChecklistStatus) {
    if (!accessToken || workingId) return;

    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist/${itemId}`, {
        method: "PATCH",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ status }),
      });
      const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel atualizar a tarefa.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar tarefa.");
    } finally {
      setWorkingId("");
    }
  }

  async function removeItem(itemId: string) {
    if (!accessToken || workingId) return;

    // Item do Cofre costuma ser a unica copia de um localizador. Um toque
    // errado no celular nao pode apagar isso em silencio.
    const item = items.find((entry) => entry.id === itemId);
    const ok = window.confirm(
      `Remover "${item?.title ?? "este item"}" do Cofre? Os anexos dele também são apagados.`
    );
    if (!ok) return;

    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist/${itemId}`, {
        method: "DELETE",
        headers: authJsonHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel remover a tarefa.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover tarefa.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="checklist-layout">
      <div className="card checklist-control">
        <span className="badge b-ok">planejamento vivo</span>
        <h2>Checklist da viagem</h2>
        <p className="sub">
          Aqui ficam as pendencias reais antes de viajar. O Planvoro cruza roteiro, Cofre e grupo
          para sugerir o que ainda precisa ser resolvido.
        </p>

        <div className="checklist-meter">
          <div>
            <span className="stat-label">Progresso</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-line">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="tiny">
            {doneItems.length} feita{doneItems.length === 1 ? "" : "s"} · {openItems.length} pendente
            {openItems.length === 1 ? "" : "s"}
          </p>
        </div>

        <label>Nova tarefa</label>
        <input
          value={form.title}
          onChange={(event) => updateForm({ title: event.target.value })}
          placeholder="Ex: confirmar horário do check-in"
        />

        <div className="grid2 tight">
          <div>
            <label>Categoria</label>
            <select
              value={form.category}
              onChange={(event) => updateForm({ category: event.target.value as TripChecklistCategory })}
            >
              {TRIP_CHECKLIST_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Prazo</label>
            <input
              type="date"
              value={form.due_date}
              min={trip.start_date}
              max={trip.end_date}
              onChange={(event) => updateForm({ due_date: event.target.value })}
            />
          </div>
        </div>

        <label>Notas</label>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(event) => updateForm({ notes: event.target.value })}
          placeholder="Detalhes, link, pessoa responsavel ou contexto..."
        />

        {error && <div className="err">{error}</div>}

        <button className="btn full" onClick={() => createItem()} disabled={saving || !form.title.trim()}>
          {saving ? "Salvando tarefa..." : "Adicionar tarefa"}
        </button>
      </div>

      <div className="checklist-stack">
        {suggestions.length > 0 && (
          <div className="card">
            <h3>Sugestoes do Planvoro</h3>
            <p className="sub">Atalhos baseados no que ainda nao aparece no Cofre ou no grupo.</p>
            <div className="checklist-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.title}
                  type="button"
                  className="option-card"
                  onClick={() => createItem({ ...suggestion, source: "suggested" })}
                  disabled={saving}
                >
                  <strong>{suggestion.title}</strong>
                  <span>{suggestion.notes}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="dashboard-head">
            <div>
              <h3>Tarefas da viagem</h3>
              <p className="sub">Marque como feito, ignore o que nao se aplica ou remova tarefas antigas.</p>
            </div>
            <span className="badge b-ok">{items.length} total</span>
          </div>

          {items.length === 0 ? (
            <div className="note">
              <b>Nenhuma tarefa ainda</b>
              <br />
              Adicione tarefas manuais ou aceite uma sugestao para comecar.
            </div>
          ) : (
            <div className="checklist-items">
              {sortedItems.map((item) => (
                <div className={`checklist-item ${item.status}`} key={item.id}>
                  <button
                    type="button"
                    className="check-toggle"
                    onClick={() => setItemStatus(item.id, item.status === "done" ? "open" : "done")}
                    disabled={workingId === item.id}
                    aria-label={item.status === "done" ? "Reabrir tarefa" : "Marcar tarefa como feita"}
                  >
                    {item.status === "done" ? "✓" : ""}
                  </button>
                  <div className="check-body">
                    <div className="check-title">
                      <strong>{item.title}</strong>
                      <span className={`badge ${item.status === "open" ? "b-warn" : "b-ok"}`}>
                        {checklistStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="tiny">
                      {checklistCategoryLabel(item.category)} · {formatDueDate(item.due_date)}
                      {item.source === "suggested" ? " · sugerido" : ""}
                    </p>
                    {item.notes && <p className="item-d">{item.notes}</p>}
                    <div className="check-actions">
                      {item.status !== "skipped" && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setItemStatus(item.id, "skipped")}
                          disabled={workingId === item.id}
                        >
                          Ignorar
                        </button>
                      )}
                      {item.status === "skipped" && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setItemStatus(item.id, "open")}
                          disabled={workingId === item.id}
                        >
                          Reabrir
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => removeItem(item.id)}
                        disabled={workingId === item.id}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MAX_PENDING_ATTACHMENTS = 12;

/**
 * Aba Mapa: um dia por vez, com os lugares que a verificacao geolocalizou.
 *
 * Item sem coordenada nao aparece, e isso e dito na tela. Plotar um
 * chute no meio do mapa seria pior do que nao plotar: a pessoa iria ate
 * o lugar errado.
 */
function TripMapView({ itinerary }: { itinerary: Itinerary | null }) {
  const days = itinerary?.itinerary_days ?? [];
  const [dayIndex, setDayIndex] = useState(0);

  const daysWithPoints = days.map((day) => ({
    day,
    points: day.itinerary_items
      .filter((item) => typeof item.lat === "number" && typeof item.lng === "number")
      .map<GeoPoint>((item, index) => ({
        id: item.id,
        title: item.title,
        lat: item.lat as number,
        lng: item.lng as number,
        startTime: item.start_time,
        position: item.position ?? index,
      })),
  }));

  const mappable = daysWithPoints.filter((entry) => entry.points.length > 0);

  if (!itinerary) {
    return (
      <div className="card">
        <h2>Mapa</h2>
        <p className="sub">Gere o roteiro primeiro. O mapa usa os lugares que a IA verificou.</p>
      </div>
    );
  }

  if (!mappable.length) {
    return (
      <div className="card">
        <h2>Mapa</h2>
        <p className="sub">
          Nenhum item do roteiro tem coordenada confirmada ainda. Só entram no mapa os lugares que
          a verificação conseguiu localizar — plotar um palpite levaria você ao endereço errado.
        </p>
      </div>
    );
  }

  const safeIndex = Math.min(dayIndex, mappable.length - 1);
  const active = mappable[safeIndex];
  const route = suggestRoute(active.points);

  return (
    <div className="map-layout">
      <div className="card map-card">
        <div className="map-head">
          <div>
            <span className="stat-label">
              {mappable.length === days.length
                ? `Dia ${safeIndex + 1} de ${days.length}`
                : `Dia ${safeIndex + 1} de ${mappable.length} com lugares no mapa`}
            </span>
            <h2>{active.day.title || formatVaultDate(`${active.day.day_date}T12:00:00`)}</h2>
          </div>
          <div className="map-nav">
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
            >
              Anterior
            </button>
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => setDayIndex((i) => Math.min(mappable.length - 1, i + 1))}
              disabled={safeIndex >= mappable.length - 1}
            >
              Proximo
            </button>
          </div>
        </div>

        <TripMap points={route.current} />

        <p className="tiny">
          {active.points.length === 1
            ? "1 lugar no mapa neste dia"
            : `${active.points.length} lugares no mapa · ${formatKm(route.currentKm)} de deslocamento em linha reta`}
        </p>
      </div>

      <div className="card">
        <span className="badge b-ok">ordem do dia</span>
        <h3>Como está hoje</h3>
        <ol className="map-order">
          {route.current.map((point) => (
            <li key={point.id}>
              <strong>{point.title}</strong>
              {point.startTime && <span className="tiny">{point.startTime}</span>}
            </li>
          ))}
        </ol>

        {route.worthIt ? (
          <div className="note">
            <b>Dá para andar {formatKm(route.savedKm)} a menos</b>
            <br />
            Visitando nesta ordem: {route.suggested.map((point) => point.title).join(" → ")}.
            {route.fixedCount > 0 && (
              <>
                {" "}
                Confira antes: {route.fixedCount} item{route.fixedCount === 1 ? "" : "s"} tem
                horário marcado e talvez não possa mudar de lugar.
              </>
            )}
          </div>
        ) : (
          <p className="tiny">
            A ordem atual já está boa: reorganizar economizaria pouco para o trabalho de remarcar
            tudo.
          </p>
        )}

        <p className="tiny">
          Distâncias em linha reta, não por rua. Servem para perceber travessia desnecessária da
          cidade, não para calcular tempo de trajeto.
        </p>
      </div>
    </div>
  );
}

function TravelVaultView({
  accessToken,
  slug,
  trip,
  items,
  attachments,
  members,
  me,
  onChange,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  items: TripVaultItem[];
  attachments: TripVaultAttachment[];
  members: Member[];
  me: Member;
  onChange: () => Promise<void> | void;
}) {
  const emptyForm = {
    kind: "flight" as TripVaultKind,
    status: "saved" as TripVaultStatus,
    title: "",
    provider: "",
    confirmation_code: "",
    starts_at: "",
    ends_at: "",
    location: "",
    amount: "",
    currency: "BRL",
    url: "",
    notes: "",
  };
  const [form, setForm] = useState({
    ...emptyForm,
  });
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<VaultImportResult | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  // Arquivos escolhidos antes de o item existir. Sobem logo depois do insert.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingPending, setUploadingPending] = useState(false);
  const newItemFileRef = useRef<HTMLInputElement | null>(null);

  const totalKnown = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const attentionCount = items.filter((item) => item.status === "attention").length;
  const activeItems = items.filter((item) => item.status !== "canceled");
  const sortedItems = [...items].sort((a, b) => {
    const dateA = a.starts_at ? new Date(a.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.starts_at ? new Date(b.starts_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (dateA !== dateB) return dateA - dateB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const upcomingItems = sortedItems
    .filter((item) => item.status !== "canceled" && item.starts_at)
    .slice(0, 4);
  const hasTravelMovement = activeItems.some((item) => item.kind === "flight" || item.kind === "transport");
  const hasLodging = activeItems.some((item) => item.kind === "lodging");
  const hasDocument = activeItems.some((item) => item.kind === "visa" || item.kind === "document");
  const reservedNotPaidCount = activeItems.filter((item) => item.status === "reserved").length;
  const outsideTripCount = activeItems.filter((item) => isOutsideTripDates(item, trip)).length;
  const vaultInsights = [
    !hasTravelMovement && {
      tone: "warn",
      title: "Transporte ainda solto",
      body: "Guarde passagem, trem, transfer ou carro para o grupo saber como chega e sai.",
    },
    !hasLodging && {
      tone: "warn",
      title: "Hospedagem sem registro",
      body: "Quando escolher hotel ou Airbnb, salve endereco, check-in e codigo aqui.",
    },
    !hasDocument && {
      tone: "neutral",
      title: "Documentos e regras",
      body: "Vale guardar visto, seguro, apolice, pasta de documentos ou requisitos de entrada.",
    },
    attentionCount > 0 && {
      tone: "warn",
      title: `${attentionCount} item${attentionCount === 1 ? "" : "s"} para conferir`,
      body: "Revise itens marcados como atencao antes de fechar o roteiro.",
    },
    reservedNotPaidCount > 0 && {
      tone: "neutral",
      title: `${reservedNotPaidCount} reserva${reservedNotPaidCount === 1 ? "" : "s"} sem pago`,
      body: "Se ja foi pago, marque como pago para o custo conhecido ficar mais confiavel.",
    },
    outsideTripCount > 0 && {
      tone: "warn",
      title: "Data fora da viagem",
      body: "Existe item com data antes ou depois do periodo da viagem. Pode ser fuso, conexao ou erro.",
    },
  ].filter(Boolean) as Array<{ tone: "warn" | "neutral"; title: string; body: string }>;

  function updateForm(next: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId("");
    setImportError("");
    setImportResult(null);
    setPendingFiles([]);
    if (newItemFileRef.current) newItemFileRef.current.value = "";
  }

  function addPendingFiles(files: File[]) {
    setError("");

    const accepted: File[] = [];
    for (const file of files) {
      if (file.size > VAULT_ATTACHMENT_MAX_BYTES) {
        setError(`"${file.name}" passa de ${formatFileSize(VAULT_ATTACHMENT_MAX_BYTES)}.`);
        continue;
      }
      accepted.push(file);
    }

    setPendingFiles((current) => [...current, ...accepted].slice(0, MAX_PENDING_ATTACHMENTS));
    if (newItemFileRef.current) newItemFileRef.current.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((current) => current.filter((_, position) => position !== index));
  }

  function startEditing(item: TripVaultItem) {
    setEditingId(item.id);
    setError("");
    setPendingFiles([]);
    setImportError("");
    setImportResult(null);
    setForm({
      kind: item.kind,
      status: item.status,
      title: item.title,
      provider: item.provider ?? "",
      confirmation_code: item.confirmation_code ?? "",
      starts_at: toDateTimeLocalValue(item.starts_at),
      ends_at: toDateTimeLocalValue(item.ends_at),
      location: item.location ?? "",
      amount: item.amount == null ? "" : String(item.amount),
      currency: item.currency,
      url: item.url ?? "",
      notes: item.notes ?? "",
    });
  }

  function itemPayload() {
    return {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
  }

  function applyImportDraft(draft: VaultImportDraft) {
    setEditingId("");
    setError("");
    setForm({
      kind: draft.kind,
      status: draft.status,
      title: draft.title,
      provider: draft.provider ?? "",
      confirmation_code: draft.confirmation_code ?? "",
      starts_at: toDateTimeLocalValue(draft.starts_at),
      ends_at: toDateTimeLocalValue(draft.ends_at),
      location: draft.location ?? "",
      amount: draft.amount == null ? "" : String(draft.amount),
      currency: draft.currency,
      url: draft.url ?? "",
      notes: draft.notes ?? "",
    });
    setImportResult({
      confidence: draft.confidence,
      missing_fields: draft.missing_fields,
      summary: draft.summary,
    });
  }

  /**
   * Le um PDF ou print da confirmacao.
   *
   * O arquivo vai so para leitura: nada e salvo no Cofre ate a pessoa
   * revisar o rascunho e clicar em guardar, igual ao texto colado.
   */
  async function importFromFile(file: File) {
    if (!accessToken || importing) return;

    setImporting(true);
    setImportError("");
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);
      if (importText.trim()) body.append("text", importText.trim());

      const res = await fetch(`/api/trips/${slug}/vault/import`, {
        method: "POST",
        headers: authHeaders(accessToken),
        body,
      });
      const json = await readApiJson<{ draft?: VaultImportDraft; error?: string }>(res);
      if (!res.ok || !json.draft) {
        if (res.status === 429) track("limite_atingido", { acao: "importacao_cofre" });
        throw new Error(json.error ?? "Nao foi possivel ler esse arquivo.");
      }

      track("cofre_importacao_usada", { confianca: json.draft.confidence, origem: "arquivo" });
      applyImportDraft(json.draft);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erro ao ler o arquivo.");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  async function importReservation() {
    if (!accessToken || importing) return;

    const text = importText.trim();
    if (text.length < 40) {
      setImportError("Cole um email, recibo ou confirmacao com mais detalhes.");
      return;
    }

    setImporting(true);
    setImportError("");
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/import`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ text }),
      });
      const json = await readApiJson<{ draft?: VaultImportDraft; error?: string }>(res);
      if (!res.ok || !json.draft) {
        if (res.status === 429) track("limite_atingido", { acao: "importacao_cofre" });
        throw new Error(json.error ?? "Nao foi possivel importar esse texto.");
      }

      track("cofre_importacao_usada", { confianca: json.draft.confidence });
      applyImportDraft(json.draft);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Erro ao importar reserva.");
    } finally {
      setImporting(false);
    }
  }

  async function saveItem() {
    if (!accessToken || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(editingId ? `/api/trips/${slug}/vault/${editingId}` : `/api/trips/${slug}/vault`, {
        method: editingId ? "PATCH" : "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify(itemPayload()),
      });
      const json = await readApiJson<{ item?: TripVaultItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel atualizar o Cofre.");

      // O item ja esta salvo. Se um anexo falhar daqui pra frente, o item
      // continua valendo: avisamos o que nao subiu em vez de desfazer tudo.
      track("cofre_item_salvo", { tipo: form.kind, edicao: Boolean(editingId) });

      const createdId = editingId ? "" : json.item?.id;
      if (createdId && pendingFiles.length && accessToken) {
        setUploadingPending(true);

        const failed: string[] = [];
        for (const file of pendingFiles) {
          try {
            await uploadVaultAttachment(slug, createdId, file, accessToken);
          } catch {
            failed.push(file.name);
          }
        }

        setUploadingPending(false);

        if (failed.length) {
          setPendingFiles([]);
          await onChange();
          setError(
            `Item salvo, mas nao consegui anexar: ${failed.join(", ")}. Tente anexar pelo card do item.`
          );
          return;
        }
      }

      resetForm();
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar no Cofre.");
    } finally {
      setSaving(false);
    }
  }

  async function setItemStatus(itemId: string, status: TripVaultStatus) {
    if (!accessToken || workingId) return;

    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/${itemId}`, {
        method: "PATCH",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ status }),
      });
      const json = await readApiJson<{ item?: TripVaultItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel atualizar o status.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar status.");
    } finally {
      setWorkingId("");
    }
  }

  async function removeItem(itemId: string) {
    if (!accessToken || workingId) return;

    setWorkingId(itemId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/${itemId}`, {
        method: "DELETE",
        headers: authJsonHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel remover o item.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover do Cofre.");
    } finally {
      setWorkingId("");
    }
  }

  const attachmentsByItem = new Map<string, TripVaultAttachment[]>();
  for (const attachment of attachments) {
    const list = attachmentsByItem.get(attachment.item_id);
    if (list) list.push(attachment);
    else attachmentsByItem.set(attachment.item_id, [attachment]);
  }

  const memberName = (memberId: string | null) =>
    members.find((member) => member.id === memberId)?.name ?? "grupo";
  const canManage = (item: TripVaultItem) => me.is_organizer || item.member_id === me.id;

  return (
    <div className="vault-layout">
      <div className="card vault-form-card">
        <div className="vault-form-head">
          <span className="badge b-ok">{editingId ? "editando item" : "central da viagem"}</span>
          {editingId && (
            <button className="btn ghost sm" type="button" onClick={resetForm} disabled={saving}>
              Cancelar edicao
            </button>
          )}
        </div>
        <h2>{editingId ? "Editar item do Cofre" : "Cofre de reservas e documentos"}</h2>
        <p className="sub">
          Guarde tudo que foi comprado, reservado ou precisa ser conferido: voos, hospedagens,
          passeios, seguros, vistos, restaurantes, links e codigos.
        </p>

        <div className="vault-summary">
          <div>
            <span className="stat-label">Itens salvos</span>
            <strong>{items.length}</strong>
          </div>
          <div>
            <span className="stat-label">Na agenda</span>
            <strong>{upcomingItems.length}</strong>
          </div>
          <div>
            <span className="stat-label">Conferir</span>
            <strong>{attentionCount}</strong>
          </div>
          <div>
            <span className="stat-label">Valor conhecido</span>
            <strong>{formatMoney(totalKnown)}</strong>
          </div>
        </div>

        {!editingId && (
          <div className="vault-import-box">
            <div className="vault-import-head">
              <div>
                <span className="badge b-warn">importacao inteligente</span>
                <h3>Colar confirmacao</h3>
              </div>
              <span className="tiny">Nada e salvo automaticamente.</span>
            </div>
            <p className="sub">
              Cole um email ou recibo, ou envie o PDF da confirmacao e o print da tela. O
              Planvoro extrai um rascunho para voce revisar antes de guardar no Cofre.
            </p>
            <textarea
              rows={5}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Ex: confirmacao de voo, reserva do hotel, seguro viagem, ingresso, transfer..."
            />
            <div className="vault-import-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={importReservation}
                disabled={importing || !accessToken || importText.trim().length < 40}
              >
                {importing ? "Extraindo..." : "Extrair do texto"}
              </button>
              <input
                ref={importFileRef}
                className="hidden-file"
                type="file"
                accept={VAULT_ATTACHMENT_MIME_TYPES.join(",")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFromFile(file);
                }}
              />
              <button
                className="btn ghost"
                type="button"
                onClick={() => importFileRef.current?.click()}
                disabled={importing || !accessToken}
              >
                Ler PDF ou print
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setImportText("");
                  setImportError("");
                  setImportResult(null);
                }}
                disabled={importing || !importText.trim()}
              >
                Limpar texto
              </button>
            </div>
            {importError && <div className="err">{importError}</div>}
            {importResult && (
              <div className="vault-import-result">
                <strong>Rascunho preenchido. Confira antes de salvar.</strong>
                <span>{importResult.summary}</span>
                <small>
                  Confianca estimada: {Math.round(importResult.confidence * 100)}%
                  {importResult.missing_fields.length
                    ? ` · Falta conferir: ${importResult.missing_fields.join(", ")}`
                    : " · Sem campos criticos pendentes"}
                </small>
              </div>
            )}
          </div>
        )}

        <div className="grid2 tight">
          <div>
            <label>Tipo</label>
            <select
              value={form.kind}
              onChange={(event) => updateForm({ kind: event.target.value as TripVaultKind })}
            >
              {TRIP_VAULT_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select
              value={form.status}
              onChange={(event) => updateForm({ status: event.target.value as TripVaultStatus })}
            >
              {TRIP_VAULT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label>Nome do item</label>
        <input
          value={form.title}
          onChange={(event) => updateForm({ title: event.target.value })}
          placeholder="Voo LATAM SP para Lisboa, Hotel, Seguro viagem..."
        />

        <div className="grid2 tight">
          <div>
            <label>Fornecedor</label>
            <input
              value={form.provider}
              onChange={(event) => updateForm({ provider: event.target.value })}
              placeholder="LATAM, Booking, Airbnb, Civitatis..."
            />
          </div>
          <div>
            <label>Codigo / localizador</label>
            <input
              value={form.confirmation_code}
              onChange={(event) => updateForm({ confirmation_code: event.target.value })}
              placeholder="ABC123"
            />
          </div>
        </div>

        <div className="grid2 tight">
          <div>
            <label>Comeca em</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(event) => updateForm({ starts_at: event.target.value })}
            />
          </div>
          <div>
            <label>Termina em</label>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(event) => updateForm({ ends_at: event.target.value })}
            />
          </div>
        </div>

        <label>Local</label>
        <input
          value={form.location}
          onChange={(event) => updateForm({ location: event.target.value })}
          placeholder="Aeroporto, endereço do hotel, ponto de encontro..."
        />

        <div className="grid2 tight">
          <div>
            <label>Valor</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm({ amount: event.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label>Moeda</label>
            <input
              value={form.currency}
              onChange={(event) => updateForm({ currency: event.target.value.toUpperCase() })}
              placeholder="BRL"
            />
          </div>
        </div>

        <label>Link</label>
        <input
          value={form.url}
          onChange={(event) => updateForm({ url: event.target.value })}
          placeholder="https://..."
        />

        <label>Notas</label>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(event) => updateForm({ notes: event.target.value })}
          placeholder="Check-in, franquia de bagagem, regras de cancelamento, documentos..."
        />

        {!editingId && (
          <div className="vault-pending-box">
            <div className="vault-attachments-head">
              <div>
                <label>Anexos</label>
                <span className="tiny">PDF, print ou comprovante. Sobem junto ao guardar.</span>
              </div>
              <input
                ref={newItemFileRef}
                className="hidden-file"
                type="file"
                multiple
                accept={VAULT_ATTACHMENT_MIME_TYPES.join(",")}
                onChange={(event) => addPendingFiles(Array.from(event.target.files ?? []))}
              />
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => newItemFileRef.current?.click()}
                disabled={saving || pendingFiles.length >= MAX_PENDING_ATTACHMENTS}
              >
                Escolher arquivos
              </button>
            </div>

            {pendingFiles.length > 0 && (
              <ul className="vault-attachment-list">
                {pendingFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    <div>
                      <strong>{file.name}</strong>
                      <small>{formatFileSize(file.size)}</small>
                    </div>
                    <div>
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => removePendingFile(index)}
                        disabled={saving}
                      >
                        Tirar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <div className="err">{error}</div>}

        <button className="btn full" onClick={saveItem} disabled={saving || !form.title.trim() || !accessToken}>
          {uploadingPending
            ? "Enviando anexos..."
            : saving
              ? "Salvando..."
              : editingId
                ? "Salvar alteracoes"
                : "Guardar no Cofre"}
        </button>
      </div>

      <div className="vault-list">
        <div className="vault-smart-grid">
          <div className="card vault-timeline-card">
            <span className="badge b-ok">proximos</span>
            <h3>Agenda do Cofre</h3>
            {upcomingItems.length === 0 ? (
              <p className="sub">Adicione datas em voos, hospedagens e reservas para montar a linha do tempo.</p>
            ) : (
              <div className="vault-timeline">
                {upcomingItems.map((item) => (
                  <button
                    type="button"
                    className="vault-timeline-item"
                    key={item.id}
                    onClick={() => startEditing(item)}
                    disabled={!canManage(item)}
                  >
                    <span>{formatVaultDate(item.starts_at)}</span>
                    <strong>{item.title}</strong>
                    <small>{vaultKindLabel(item.kind)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card vault-insights-card">
            <span className="badge b-warn">radar</span>
            <h3>Alertas inteligentes</h3>
            {vaultInsights.length === 0 ? (
              <p className="sub">O Cofre esta redondo: itens essenciais cadastrados e nada marcado para conferir.</p>
            ) : (
              <div className="vault-insights">
                {vaultInsights.map((insight) => (
                  <div className={`vault-insight ${insight.tone}`} key={insight.title}>
                    <strong>{insight.title}</strong>
                    <span>{insight.body}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="card">
            <h3>Cofre vazio</h3>
            <p className="sub">
              Quando voce tiver um localizador, reserva, comprovante ou link importante, guarda aqui
              para o grupo nao depender de prints perdidos no WhatsApp.
            </p>
            <div className="note">
              <b>Bom primeiro item</b>
              <br />
              Comece cadastrando o hotel ou o voo principal da viagem.
            </div>
          </div>
        ) : (
          sortedItems.map((item) => (
            <div className={`vault-card ${item.status}`} key={item.id}>
              <div className="vault-card-head">
                <div>
                  <span className="stat-label">{vaultKindLabel(item.kind)}</span>
                  <h3>{item.title}</h3>
                </div>
                <span className={`badge ${item.status === "attention" ? "b-warn" : "b-ok"}`}>
                  {vaultStatusLabel(item.status)}
                </span>
              </div>

              <div className="vault-meta-grid">
                <div>
                  <span>Quando</span>
                  <strong>{formatVaultRange(item)}</strong>
                </div>
                <div>
                  <span>Fornecedor</span>
                  <strong>{item.provider || "nao informado"}</strong>
                </div>
                <div>
                  <span>Codigo</span>
                  <strong>{item.confirmation_code || "sem codigo"}</strong>
                </div>
                <div>
                  <span>Valor</span>
                  <strong>
                    {item.amount == null ? "nao informado" : `${item.currency} ${Number(item.amount).toFixed(2)}`}
                  </strong>
                </div>
              </div>

              {item.location && <p className="small">{item.location}</p>}
              {item.notes && <p className="item-d">{item.notes}</p>}
              {isOutsideTripDates(item, trip) && (
                <div className="note tight">
                  A data deste item parece cair fora do periodo da viagem. Confira fuso, conexao ou
                  horario cadastrado.
                </div>
              )}

              <div className="vault-status-actions">
                {item.status !== "reserved" && (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "reserved")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Reservado
                  </button>
                )}
                {item.status !== "paid" && (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "paid")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Pago
                  </button>
                )}
                {item.status !== "attention" && (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "attention")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Conferir
                  </button>
                )}
                {item.status === "canceled" ? (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "saved")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Reabrir
                  </button>
                ) : (
                  <button
                    className="btn ghost sm"
                    onClick={() => setItemStatus(item.id, "canceled")}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <VaultAttachmentsBlock
                accessToken={accessToken}
                slug={slug}
                itemId={item.id}
                attachments={attachmentsByItem.get(item.id) ?? []}
                canManage={canManage(item)}
                onChange={onChange}
              />

              <div className="vault-card-actions">
                <span className="tiny">Salvo por {memberName(item.member_id)}</span>
                <div>
                  {item.url && (
                    <a className="btn ghost sm" href={item.url} target="_blank" rel="noreferrer">
                      Abrir link
                    </a>
                  )}
                  <button
                    className="btn ghost sm"
                    onClick={() => startEditing(item)}
                    disabled={!canManage(item)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => removeItem(item.id)}
                    disabled={workingId === item.id || !canManage(item)}
                  >
                    {workingId === item.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Upload de um anexo. Usado tanto pelo card de um item ja salvo quanto pelo
 * formulario de criacao, que segura os arquivos ate o item existir no banco.
 */
async function uploadVaultAttachment(
  slug: string,
  itemId: string,
  file: File,
  accessToken: string
) {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`/api/trips/${slug}/vault/${itemId}/attachments`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body,
  });
  const json = await readApiJson<{ attachment?: TripVaultAttachment; error?: string }>(res);
  if (!res.ok) throw new Error(json.error ?? "Nao foi possivel anexar o arquivo.");

  // So tipo e tamanho: nome de arquivo pode carregar dado pessoal.
  track("cofre_anexo_enviado", { mime: file.type, bytes: file.size });

  return json.attachment;
}

function VaultAttachmentsBlock({
  accessToken,
  slug,
  itemId,
  attachments,
  canManage,
  onChange,
}: {
  accessToken: string | null;
  slug: string;
  itemId: string;
  attachments: TripVaultAttachment[];
  canManage: boolean;
  onChange: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    if (!accessToken || uploading) return;

    if (file.size > VAULT_ATTACHMENT_MAX_BYTES) {
      setError(`Arquivo maior que ${formatFileSize(VAULT_ATTACHMENT_MAX_BYTES)}.`);
      return;
    }

    setUploading(true);
    setError("");

    try {
      await uploadVaultAttachment(slug, itemId, file, accessToken);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao anexar arquivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /**
   * O bucket e privado: pedimos ao servidor uma signed URL curta na hora do
   * clique, em vez de guardar link permanente no HTML.
   */
  async function openAttachment(attachment: TripVaultAttachment, download = false) {
    if (!accessToken || workingId) return;

    setWorkingId(attachment.id);
    setError("");

    try {
      const query = download ? "?download=1" : "";
      const res = await fetch(
        `/api/trips/${slug}/vault/${itemId}/attachments/${attachment.id}${query}`,
        { headers: authHeaders(accessToken) }
      );
      const json = await readApiJson<{ url?: string; error?: string }>(res);
      if (!res.ok || !json.url) throw new Error(json.error ?? "Nao foi possivel abrir o anexo.");

      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir anexo.");
    } finally {
      setWorkingId("");
    }
  }

  async function removeAttachment(attachment: TripVaultAttachment) {
    if (!accessToken || workingId) return;

    setWorkingId(attachment.id);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/vault/${itemId}/attachments/${attachment.id}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel remover o anexo.");

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover anexo.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="vault-attachments">
      <div className="vault-attachments-head">
        <span className="stat-label">Anexos</span>
        {canManage && (
          <>
            <input
              ref={inputRef}
              className="hidden-file"
              type="file"
              accept={VAULT_ATTACHMENT_MIME_TYPES.join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !accessToken}
            >
              {uploading ? "Enviando..." : "Anexar arquivo"}
            </button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="tiny">
          PDF, print ou comprovante ficam guardados aqui, visiveis so para quem participa da viagem.
        </p>
      ) : (
        <ul className="vault-attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <div>
                <strong>{attachment.file_name}</strong>
                <small>{formatFileSize(attachment.size_bytes)}</small>
              </div>
              <div>
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => openAttachment(attachment)}
                  disabled={workingId === attachment.id || !accessToken}
                >
                  Abrir
                </button>
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => openAttachment(attachment, true)}
                  disabled={workingId === attachment.id || !accessToken}
                >
                  Baixar
                </button>
                {canManage && (
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => removeAttachment(attachment)}
                    disabled={workingId === attachment.id || !accessToken}
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="err">{error}</div>}
    </div>
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
      <h3>Cofre, gastos e checklist estao trancados</h3>
      <p className="sub">
        Roteiro, grupo, ideias e votacao continuam liberados. O que ja foi salvo continua visivel e
        pode ser removido — nada fica preso aqui dentro.
      </p>
      {isOrganizer ? (
        <a className="btn" href={`/app?liberar=${slug}`}>
          Liberar esta viagem
        </a>
      ) : (
        <p className="tiny">
          Quem organiza a viagem pode liberar para o grupo todo. Voce nao precisa pagar nada.
        </p>
      )}
    </div>
  );
}

function isOutsideTripDates(item: TripVaultItem, trip: Trip) {
  if (!item.starts_at && !item.ends_at) return false;

  const tripStart = new Date(`${trip.start_date}T00:00:00`);
  const tripEnd = new Date(`${trip.end_date}T23:59:59`);
  const itemDates = [item.starts_at, item.ends_at]
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()));

  return itemDates.some((date) => date < tripStart || date > tripEnd);
}

function TravelAgentView({
  accessToken,
  slug,
  trip,
  members,
  preferences,
  itinerary,
  ideas,
  expenses,
  vaultItems,
  checklistItems,
  onChange,
  onOpenChecklist,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  members: Member[];
  preferences: Preference[];
  itinerary: Itinerary | null;
  ideas: Idea[];
  expenses: Expense[];
  vaultItems: TripVaultItem[];
  checklistItems: TripChecklistItem[];
  onChange: () => Promise<void> | void;
  onOpenChecklist: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AgentReply | null>(null);
  const [asking, setAsking] = useState(false);
  const [savingTaskKey, setSavingTaskKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");

  async function askAgent(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!accessToken || !cleanQuestion || asking) return;

    setQuestion(cleanQuestion);
    setAsking(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/agent`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ question: cleanQuestion }),
      });
      const json = await readApiJson<AgentReply & { error?: string }>(res);
      if (!res.ok) {
        if (res.status === 429) track("limite_atingido", { acao: "agente" });
        throw new Error(json.error ?? "Nao foi possivel falar com o agente.");
      }

      track("agente_pergunta_feita");
      setReply(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao falar com o agente.");
    } finally {
      setAsking(false);
    }
  }

  const hasTask = (title: string) =>
    checklistItems.some((item) => item.title.trim().toLowerCase() === title.trim().toLowerCase());

  async function createAgentTask(title: string, category: TripChecklistCategory, key = title) {
    if (!accessToken || savingTaskKey || !title.trim()) return false;
    if (hasTask(title)) {
      setActionMessage("Essa tarefa ja esta no Checklist.");
      return false;
    }

    setSavingTaskKey(key);
    setActionMessage("");
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/checklist`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({
          title,
          category,
          notes: `Criado pelo Agente a partir da pergunta: ${question || "pergunta sugerida"}`,
          source: "suggested",
        }),
      });
      const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel enviar para o Checklist.");

      await onChange();
      setActionMessage("Tarefa enviada para o Checklist.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar tarefa pelo Agente.");
      return false;
    } finally {
      setSavingTaskKey("");
    }
  }

  async function saveAllNextSteps() {
    if (!reply?.next_steps.length || savingTaskKey) return;

    setSavingTaskKey("all-next-steps");
    setActionMessage("");
    setError("");

    let created = 0;
    try {
      for (const step of reply.next_steps) {
        if (hasTask(step)) continue;
        const res = await fetch(`/api/trips/${slug}/checklist`, {
          method: "POST",
          headers: authJsonHeaders(accessToken),
          body: JSON.stringify({
            title: step,
            category: categorizeAgentTask(step),
            notes: `Criado pelo Agente a partir da pergunta: ${question || "pergunta sugerida"}`,
            source: "suggested",
          }),
        });
        const json = await readApiJson<{ item?: TripChecklistItem; error?: string }>(res);
        if (!res.ok) throw new Error(json.error ?? "Nao foi possivel enviar os passos para o Checklist.");
        created += 1;
      }

      await onChange();
      setActionMessage(
        created
          ? `${created} tarefa${created === 1 ? "" : "s"} enviada${created === 1 ? "" : "s"} para o Checklist.`
          : "Todos esses passos ja estavam no Checklist."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar passos no Checklist.");
    } finally {
      setSavingTaskKey("");
    }
  }

  const donePreferences = preferences.length;
  const routeDays = itinerary?.itinerary_days.length ?? 0;
  const openIdeas = ideas.filter((idea) => idea.status === "open").length;
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const attentionItems = vaultItems.filter((item) => item.status === "attention").length;
  const checklistOpen = checklistItems.filter((item) => item.status === "open").length;

  return (
    <div className="agent-layout">
      <div className="card agent-hero-card">
        <span className="badge b-ok">agente ativo</span>
        <h2>Seu agente de viagem dentro do Planvoro</h2>
        <p className="sub">
          Pergunte sobre roteiro, orçamento, reservas, decisões do grupo ou próximos passos. Ele
          responde usando o que já existe nesta viagem, sem fingir disponibilidade em tempo real.
        </p>

        <div className="agent-stats">
          <div>
            <span className="stat-label">Viagem</span>
            <strong>{trip.destination}</strong>
          </div>
          <div>
            <span className="stat-label">Roteiro</span>
            <strong>{routeDays ? `${routeDays} dia${routeDays === 1 ? "" : "s"}` : "a gerar"}</strong>
          </div>
          <div>
            <span className="stat-label">Preferencias</span>
            <strong>
              {donePreferences}/{members.length}
            </strong>
          </div>
          <div>
            <span className="stat-label">Cofre</span>
            <strong>{vaultItems.length ? `${vaultItems.length} item${vaultItems.length === 1 ? "" : "s"}` : "vazio"}</strong>
          </div>
          <div>
            <span className="stat-label">Checklist</span>
            <strong>{checklistOpen ? `${checklistOpen} pendente${checklistOpen === 1 ? "" : "s"}` : "em dia"}</strong>
          </div>
          <div>
            <span className="stat-label">Gastos</span>
            <strong>{formatMoney(totalExpenses)}</strong>
          </div>
        </div>

        <label>Pergunte para o agente</label>
        <textarea
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex: o que eu deveria reservar primeiro para essa viagem?"
        />
        <button
          className="btn full"
          type="button"
          onClick={() => askAgent()}
          disabled={asking || !question.trim() || !accessToken}
        >
          {asking ? "Agente analisando a viagem..." : "Perguntar ao agente"}
        </button>

        {error && <div className="err">{error}</div>}
      </div>

      <div className="card">
        <h3>Perguntas boas para agora</h3>
        <p className="sub">
          Use uma sugestão ou escreva do seu jeito. Quanto mais concreta a pergunta, melhor a
          resposta.
        </p>
        <div className="agent-question-grid">
          {AGENT_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="option-card"
              onClick={() => askAgent(prompt)}
              disabled={asking || !accessToken}
            >
              <strong>{prompt}</strong>
            </button>
          ))}
        </div>
        {openIdeas > 0 && (
          <div className="note" style={{ marginTop: 16 }}>
            <b>Insight do agente</b>
            <br />
            Existem {openIdeas} ideia{openIdeas === 1 ? "" : "s"} aberta
            {openIdeas === 1 ? "" : "s"} no quadro. Vale separar as melhores para o roteiro antes
            de regerar.
          </div>
        )}
        {attentionItems > 0 && (
          <div className="note" style={{ marginTop: 16 }}>
            <b>Item para conferir</b>
            <br />
            O Cofre tem {attentionItems} item{attentionItems === 1 ? "" : "s"} marcado
            {attentionItems === 1 ? "" : "s"} como "precisa conferir".
          </div>
        )}
      </div>

      <div className="card agent-answer-card">
        {reply ? (
          <>
            <div className="agent-answer-head">
              <div>
                <span className="badge b-ok">resposta acionavel</span>
                <h3>Resposta do agente</h3>
              </div>
              <div className="agent-answer-actions">
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={saveAllNextSteps}
                  disabled={savingTaskKey === "all-next-steps" || !reply.next_steps.length || !accessToken}
                >
                  {savingTaskKey === "all-next-steps" ? "Enviando..." : "Salvar passos no Checklist"}
                </button>
                <button className="btn ghost sm" type="button" onClick={onOpenChecklist}>
                  Abrir Checklist
                </button>
              </div>
            </div>
            <p className="agent-answer-text">{reply.answer}</p>
            {actionMessage && <div className="note tight agent-action-note">{actionMessage}</div>}
            <div className="grid2 tight">
              <AgentList
                title="Proximos passos"
                items={reply.next_steps}
                checklistItems={checklistItems}
                savingKey={savingTaskKey}
                categoryForItem={categorizeAgentTask}
                onCreateTask={createAgentTask}
              />
              <AgentList
                title="Cuidados"
                items={reply.watchouts}
                checklistItems={checklistItems}
                savingKey={savingTaskKey}
                categoryForItem={() => "planning"}
                onCreateTask={createAgentTask}
              />
            </div>
          </>
        ) : (
          <>
            <h3>Como eu atuo aqui</h3>
            <p className="sub">
              Penso como um agente de viagem: organizo prioridades, aponto riscos, sugiro decisões
              e transformo o roteiro em plano executável. Para preços, horários e disponibilidade,
              eu sempre vou te lembrar de confirmar no canal oficial antes de fechar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function categorizeAgentTask(text: string): TripChecklistCategory {
  const value = text.toLowerCase();
  if (/(hotel|hosped|airbnb|booking|reserva|ingresso|passeio|restaurante)/.test(value)) return "booking";
  if (/(passagem|voo|aeroporto|trem|transfer|onibus|ônibus|carro|transporte)/.test(value)) return "transport";
  if (/(passaporte|visto|document|cpf|rg|autoriz|comprovante)/.test(value)) return "documents";
  if (/(seguro|vacina|saude|saúde|remedio|remédio|medic)/.test(value)) return "health";
  if (/(orcamento|orçamento|dinheiro|cambio|câmbio|cartao|cartão|pagar|pago|custo)/.test(value)) return "money";
  if (/(grupo|pessoa|confirmar|alinhar|mensagem|preferencia|preferência)/.test(value)) return "group";
  if (/(mala|bagagem|levar|arrumar)/.test(value)) return "packing";
  return "planning";
}

function AgentList({
  title,
  items,
  checklistItems,
  savingKey,
  categoryForItem,
  onCreateTask,
}: {
  title: string;
  items: string[];
  checklistItems: TripChecklistItem[];
  savingKey: string;
  categoryForItem: (item: string) => TripChecklistCategory;
  onCreateTask: (title: string, category: TripChecklistCategory, key?: string) => Promise<boolean>;
}) {
  const hasTask = (item: string) =>
    checklistItems.some((task) => task.title.trim().toLowerCase() === item.trim().toLowerCase());

  return (
    <div className="agent-list">
      <span className="stat-label">{title}</span>
      {items.length ? (
        items.map((item) => {
          const key = `${title}:${item}`;
          const saved = hasTask(item);
          return (
            <div className="agent-action-item" key={item}>
              <p>{item}</p>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => onCreateTask(item, categoryForItem(item), key)}
                disabled={Boolean(savingKey) || saved}
              >
                {savingKey === key ? "Salvando..." : saved ? "Ja no Checklist" : "Virar tarefa"}
              </button>
            </div>
          );
        })
      ) : (
        <p>Nada critico por enquanto.</p>
      )}
    </div>
  );
}

type MemberExpenseBalance = {
  member: Member;
  paid: number;
  share: number;
  balance: number;
};

type ExpenseSettlement = {
  from: Member;
  to: Member;
  amount: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function calculateExpenseBalances(expenses: Expense[], members: Member[]) {
  return members.map((member) => {
    let paid = 0;
    let share = 0;

    for (const expense of expenses) {
      const value = Number(expense.amount ?? 0);
      if (expense.payer_member_id === member.id) {
        paid += value;
      }
      if (expense.split_member_ids.includes(member.id) && expense.split_member_ids.length > 0) {
        share += value / expense.split_member_ids.length;
      }
    }

    return {
      member,
      paid: roundMoney(paid),
      share: roundMoney(share),
      balance: roundMoney(paid - share),
    };
  });
}

function calculateSettlements(balances: MemberExpenseBalance[]) {
  const debtors = balances
    .filter((entry) => entry.balance < -0.009)
    .map((entry) => ({ ...entry, cents: Math.round(Math.abs(entry.balance) * 100) }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((entry) => entry.balance > 0.009)
    .map((entry) => ({ ...entry, cents: Math.round(entry.balance * 100) }))
    .sort((a, b) => b.cents - a.cents);
  const settlements: ExpenseSettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const cents = Math.min(debtor.cents, creditor.cents);

    if (cents > 0) {
      settlements.push({
        from: debtor.member,
        to: creditor.member,
        amount: cents / 100,
      });
    }

    debtor.cents -= cents;
    creditor.cents -= cents;

    if (debtor.cents <= 0) debtorIndex += 1;
    if (creditor.cents <= 0) creditorIndex += 1;
  }

  return settlements;
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
      setInviteError(e instanceof Error ? e.message : "Nao foi possivel enviar os convites.");
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
            placeholder={`Oi! O ${me.name} ja abriu a viagem no Planvoro. Entra aqui para votar e ajustar tudo com o grupo.`}
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
          A proxima geracao vai priorizar {plannedIdeaCount} ideia
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
      <h2>Seu roteiro ainda nao existe</h2>
      <p className="sub">
        Preencha as preferencias do grupo e gere a primeira versao. Depois essa aba vira o quadro
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
      <p className="sub">Sua conta ja foi reconhecida. Falta so escolher como seu nome aparece no grupo.</p>
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
      <h2>Suas preferencias, {me.name}</h2>
      <p className="sub">A IA usa isso para equilibrar o roteiro entre todo mundo do grupo.</p>

      <label>O que voce nao quer perder</label>
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

      <label>Restricoes</label>
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

      <label>Seu orcamento por dia</label>
      <select value={budget} onChange={(e) => setBudget(e.target.value)}>
        {DAILY_BUDGETS.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>

      <div className="grid2 tight">
        <div>
          <label>Voce chega em</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>Voce sai em</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <button className="btn full" onClick={save} disabled={loading || !accessToken}>
        {loading ? "Salvando..." : saved ? "Salvo ✓" : "Salvar preferencias"}
      </button>
    </div>
  );
}

function IdeasView({
  accessToken,
  ideas,
  ideaVotes,
  members,
  me,
  slug,
  onChange,
  onGoToRoute,
}: {
  accessToken: string | null;
  ideas: Idea[];
  ideaVotes: IdeaVote[];
  members: Member[];
  me: Member;
  slug: string;
  onChange: () => Promise<void> | void;
  onGoToRoute: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState(IDEA_CATEGORIES[0]);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function scoreFor(ideaId: string) {
    return ideaVotes
      .filter((vote) => vote.idea_id === ideaId)
      .reduce((sum, vote) => sum + vote.value, 0);
  }

  const orderedIdeas = [...ideas].sort((a, b) => {
    const statusRank: Record<IdeaStatus, number> = { open: 0, planned: 1, dismissed: 2 };
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus) return byStatus;

    const byScore = scoreFor(b.id) - scoreFor(a.id);
    if (byScore) return byScore;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const openCount = ideas.filter((idea) => idea.status === "open").length;
  const plannedCount = ideas.filter((idea) => idea.status === "planned").length;
  const topIdea =
    [...ideas]
      .filter((idea) => idea.status !== "dismissed")
      .sort((a, b) => scoreFor(b.id) - scoreFor(a.id))[0] ?? null;

  async function createIdea() {
    if (!accessToken || !title.trim()) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/ideas`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({
          title,
          notes,
          category,
          estimated_cost: estimatedCost || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setTitle("");
      setNotes("");
      setCategory(IDEA_CATEGORIES[0]);
      setEstimatedCost("");
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a ideia.");
    }

    setSaving(false);
  }

  return (
    <>
      <div className="grid3">
        <div className="card stat-card">
          <span className="stat-label">Ideias abertas</span>
          <strong className="stat-value">{openCount}</strong>
          <span className="tiny">Sugestoes para o grupo lapidar</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Separadas</span>
          <strong className="stat-value">{plannedCount}</strong>
          <span className="tiny">Prontas para virar plano</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Mais quente</span>
          <strong className="stat-value">{topIdea ? formatScore(scoreFor(topIdea.id)) : "0"}</strong>
          <span className="tiny">{topIdea ? topIdea.title : "Nenhuma votacao ainda"}</span>
        </div>
      </div>

      <div className="grid2 idea-grid">
        <div className="card">
          <h2>Nova ideia</h2>
          <p className="sub">
            Jogue aqui restaurantes, passeios, bairros e planos soltos antes de travar o
            roteiro.
          </p>

          <label>Titulo</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Jantar no mercado central"
          />

          <div className="grid2 tight">
            <div>
              <label>Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {IDEA_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Custo estimado</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="120"
              />
            </div>
          </div>

          <label>Detalhes</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Por que vale entrar, horarios bons, link, restricoes..."
          />

          {error && <div className="err">{error}</div>}

          <button
            className="btn full"
            onClick={createIdea}
            disabled={saving || !title.trim() || !accessToken}
          >
            {saving ? "Salvando..." : "Adicionar ideia"}
          </button>
        </div>

        <div className="card">
          <h2>Como decidir</h2>
          <p className="sub">
            Votos deixam o grupo comparar desejo, duvida e veto antes de mexer no roteiro final.
          </p>
          <div className="note">
            <b>Fluxo recomendado</b>
            <br />
            1. Todo mundo sugere sem editar o roteiro. 2. O grupo vota. 3. As melhores ideias sao
            separadas para entrar na proxima versao.
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Quadro de ideias</h2>
        <p className="sub">Ordenado por status, votos e criacao mais recente.</p>

        {orderedIdeas.length === 0 ? (
          <div className="note">
            <b>Nenhuma ideia ainda</b>
            <br />
            Comece com aquilo que sempre aparece no grupo: restaurantes, passeios imperdiveis,
            planos de chuva ou coisas que alguem quer muito evitar.
          </div>
        ) : (
          <div className="idea-list">
            {orderedIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                accessToken={accessToken}
                idea={idea}
                votes={ideaVotes.filter((vote) => vote.idea_id === idea.id)}
                members={members}
                me={me}
                slug={slug}
                onChange={onChange}
                onGoToRoute={onGoToRoute}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function IdeaCard({
  accessToken,
  idea,
  votes,
  members,
  me,
  slug,
  onChange,
  onGoToRoute,
}: {
  accessToken: string | null;
  idea: Idea;
  votes: IdeaVote[];
  members: Member[];
  me: Member;
  slug: string;
  onChange: () => Promise<void> | void;
  onGoToRoute: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const myVote = votes.find((vote) => vote.member_id === me.id)?.value ?? null;
  const score = votes.reduce((sum, vote) => sum + vote.value, 0);
  const author = members.find((member) => member.id === idea.member_id)?.name ?? "alguem";
  const statusLabel: Record<IdeaStatus, string> = {
    open: "aberta",
    planned: "separada",
    dismissed: "descartada",
  };
  const statusBadge: Record<IdeaStatus, string> = {
    open: "b-vote",
    planned: "b-ok",
    dismissed: "b-warn",
  };
  const nameById = (id: string) => members.find((member) => member.id === id)?.name ?? "alguem";

  async function vote(value: number) {
    if (!accessToken) return;

    setWorking(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/ideas/${idea.id}/vote`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao votar na ideia.");
    }

    setWorking(false);
  }

  async function changeStatus(status: IdeaStatus) {
    if (!accessToken) return;

    setWorking(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/ideas/${idea.id}/status`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar a ideia.");
    }

    setWorking(false);
  }

  return (
    <div className={`idea-card ${idea.status}`}>
      <div className="idea-main">
        <div>
          <div className="item-t">
            {idea.title}
            <span className={`badge ${statusBadge[idea.status]}`}>{statusLabel[idea.status]}</span>
          </div>
          <div className="tiny">
            Sugerida por {author}
            {idea.category ? ` · ${idea.category}` : ""}
            {idea.estimated_cost != null ? ` · ${formatMoney(Number(idea.estimated_cost))}` : ""}
          </div>
          {idea.notes && <p className="item-d idea-notes">{idea.notes}</p>}
        </div>
        <div className="idea-score">
          <span>{formatScore(score)}</span>
          <small>saldo</small>
        </div>
      </div>

      <div className="idea-footer">
        <div className="reactions idea-reactions">
          {REACTIONS.map((reaction) => {
            const voters = votes.filter((voteItem) => voteItem.value === reaction.value);
            const active = myVote === reaction.value;

            return (
              <button
                key={reaction.value}
                type="button"
                className={`react ${active ? "on" : ""}`}
                onClick={() => vote(reaction.value)}
                disabled={working || !accessToken}
                title={
                  voters.length
                    ? voters.map((voteItem) => nameById(voteItem.member_id)).join(", ")
                    : `Ninguem marcou "${reaction.label}" ainda`
                }
              >
                <span>{reaction.emoji}</span>
                {voters.length > 0 && <b>{voters.length}</b>}
              </button>
            );
          })}
        </div>

        <div className="idea-actions">
          {idea.status === "planned" ? (
            <>
              <button type="button" className="btn ghost sm" onClick={onGoToRoute}>
                Ver roteiro
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => changeStatus("open")}
                disabled={working}
              >
                Reabrir
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn sm"
              onClick={() => changeStatus("planned")}
              disabled={working || idea.status === "dismissed"}
            >
              Separar para roteiro
            </button>
          )}

          {idea.status === "dismissed" ? (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => changeStatus("open")}
              disabled={working}
            >
              Reabrir
            </button>
          ) : (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => changeStatus("dismissed")}
              disabled={working}
            >
              Descartar
            </button>
          )}
        </div>
      </div>

      {error && <div className="err">{error}</div>}
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
        Versao {itinerary.version} · reaja e comente em qualquer item para o grupo decidir junto
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
                {day.day_date}
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
  const nameById = (id: string) => members.find((member) => member.id === id)?.name ?? "alguem";
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
          {comments.length > 0 ? `${comments.length} comentario${comments.length > 1 ? "s" : ""}` : "comentar"}
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
 * Alerta de orcamento.
 *
 * O teto e por pessoa e multiplicado pelo tamanho do grupo, porque e
 * assim que as pessoas pensam: ninguem combina "vamos gastar 6 mil",
 * combina "mil e duzentos cada um".
 */
function BudgetAlert({
  accessToken,
  slug,
  trip,
  members,
  expenses,
  isOrganizer,
  onSaved,
}: {
  accessToken: string | null;
  slug: string;
  trip: Trip;
  members: Member[];
  expenses: Expense[];
  isOrganizer: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    trip.budget_per_person == null ? "" : String(trip.budget_per_person)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headcount = trip.is_solo ? 1 : Math.max(members.length, trip.party_size);
  const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const budget = summarizeBudget({
    budgetPerPerson: trip.budget_per_person,
    headcount,
    totalSpent,
  });

  async function save() {
    if (!accessToken || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}`, {
        method: "PATCH",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ budget_per_person: value.trim() }),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel salvar o orcamento.");

      setOpen(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o orcamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`budget-alert ${budgetTone(budget.status)}`}>
      <div className="budget-alert-head">
        <div className="budget-alert-title">
          <span className="stat-label">Orçamento</span>
          <strong>{budget.headline}</strong>
        </div>
        {isOrganizer && (
          <button className="btn ghost sm" type="button" onClick={() => setOpen((v) => !v)}>
            {trip.budget_per_person == null ? "Definir" : "Ajustar"}
          </button>
        )}
      </div>

      <p className="tiny">{budget.detail}</p>

      {budget.status !== "sem_orcamento" && (
        <div className="budget-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(budget.ratio * 100, 100)}%` }} />
        </div>
      )}

      {open && (
        <div className="budget-form">
          <label>Quanto cada pessoa pretende gastar</label>
          <input
            type="number"
            min="0"
            step="10"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="1200"
          />
          <span className="tiny">
            Some tudo que sai do bolso: passagem, hospedagem, comida e passeios. Deixe em branco
            para desligar o alerta.
          </span>
          {error && <div className="err">{error}</div>}
          <div className="budget-form-actions">
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => {
                setOpen(false);
                setValue(trip.budget_per_person == null ? "" : String(trip.budget_per_person));
                setError("");
              }}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="btn sm" type="button" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Uma transferencia do acerto, com o Pix pronto.
 *
 * Sem chave cadastrada nao ha botao: mostrar "copiar Pix" e entregar um
 * codigo quebrado seria pior do que dizer que falta a chave.
 */
function PixSettlementRow({
  settlement,
  tripName,
}: {
  settlement: ExpenseSettlement;
  tripName: string;
}) {
  const [copied, setCopied] = useState(false);
  const pixKey = settlement.to.pix_key ?? "";

  async function copyPix() {
    const payload = buildPixPayload({
      key: pixKey,
      amount: settlement.amount,
      receiverName: settlement.to.name,
      reference: tripName,
    });
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      track("pix_copiado", { valor: settlement.amount });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pix-row">
      <span>
        Voce paga {formatMoney(settlement.amount)} para {settlement.to.name}
      </span>
      {pixKey ? (
        <button className="btn ghost sm" type="button" onClick={copyPix}>
          {copied ? "Codigo copiado" : "Copiar Pix"}
        </button>
      ) : (
        <span className="tiny">{settlement.to.name} ainda nao cadastrou a chave Pix.</span>
      )}
    </div>
  );
}

/** Chave Pix da propria pessoa. Cada um cuida da sua. */
function MyPixKey({
  accessToken,
  slug,
  me,
  onSaved,
}: {
  accessToken: string | null;
  slug: string;
  me: Member;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(me.pix_key ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const detected = detectPixKey(me.pix_key ?? "");

  async function save() {
    if (!accessToken || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/pix`, {
        method: "PUT",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({ pix_key: value.trim() }),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel salvar a chave.");

      setOpen(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a chave Pix.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pix-key-box">
      {!open ? (
        <div className="pix-key-state">
          <span className="tiny">
            {me.pix_key
              ? `Sua chave Pix: ${pixKeyLabel(detected.type)} cadastrada`
              : "Cadastre sua chave Pix para o grupo te pagar em um toque."}
          </span>
          <button className="btn ghost sm" type="button" onClick={() => setOpen(true)}>
            {me.pix_key ? "Trocar" : "Cadastrar chave"}
          </button>
        </div>
      ) : (
        <div className="pix-key-form">
          <label>Sua chave Pix</label>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="CPF, e-mail, telefone ou chave aleatoria"
            autoComplete="off"
          />
          <span className="tiny">
            Fica visivel para quem participa desta viagem. O Planvoro nao move dinheiro: o codigo
            abre o app do seu banco, que confirma tudo antes.
          </span>
          {error && <div className="err">{error}</div>}
          <div className="pix-key-actions">
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => {
                setOpen(false);
                setValue(me.pix_key ?? "");
                setError("");
              }}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="btn sm" type="button" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpensesView({
  accessToken,
  expenses,
  members,
  me,
  slug,
  trip,
  onSaved,
}: {
  accessToken: string | null;
  expenses: Expense[];
  members: Member[];
  me: Member;
  slug: string;
  trip: Trip;
  onSaved: () => Promise<void> | void;
}) {
  const tripName = trip.destination;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState(me.id);
  const [splitIds, setSplitIds] = useState<string[]>(members.map((member) => member.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    setPayerId((current) => (current ? current : me.id));
    setSplitIds((current) => {
      const valid = current.filter((id) => members.some((member) => member.id === id));
      return valid.length ? valid : members.map((member) => member.id);
    });
  }, [members, me.id]);

  const totalsByMember = calculateExpenseBalances(expenses, members)
    .sort((a, b) => {
      if (a.member.id === me.id) return -1;
      if (b.member.id === me.id) return 1;
      return b.balance - a.balance;
    });

  const myTotals = totalsByMember.find((entry) => entry.member.id === me.id) ?? {
    member: me,
    paid: 0,
    share: 0,
    balance: 0,
  };
  const totalSpent = roundMoney(expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0));
  const settlementPlan = calculateSettlements(totalsByMember);
  const creditors = totalsByMember.filter((entry) => entry.balance > 0.009);
  const debtors = totalsByMember.filter((entry) => entry.balance < -0.009);
  const settledMembers = totalsByMember.filter((entry) => Math.abs(entry.balance) <= 0.009).length;
  const splitPreview = Number(amount) > 0 && splitIds.length ? roundMoney(Number(amount) / splitIds.length) : 0;
  const payerName = members.find((member) => member.id === payerId)?.name ?? "quem pagou";
  const mySettlementsToPay = settlementPlan.filter((settlement) => settlement.from.id === me.id);
  const mySettlementsToReceive = settlementPlan.filter((settlement) => settlement.to.id === me.id);

  function resetForm() {
    setDescription("");
    setAmount("");
    setPayerId(me.id);
    setSplitIds(members.map((member) => member.id));
  }

  function toggleSplit(id: string) {
    setSplitIds((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((value) => value !== id);
      }
      return [...current, id];
    });
  }

  async function removeExpense(expenseId: string) {
    if (!accessToken || removingId) return;

    setRemovingId(expenseId);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/expenses/${expenseId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
      });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel remover o gasto.");

      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover o gasto.");
    } finally {
      setRemovingId("");
    }
  }

  async function saveExpense() {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/trips/${slug}/expenses`, {
        method: "POST",
        headers: authJsonHeaders(accessToken),
        body: JSON.stringify({
          payer_member_id: payerId,
          split_member_ids: splitIds,
          description,
          amount,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      resetForm();
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar o gasto.");
    }

    setSaving(false);
  }

  return (
    <>
      <div className="expense-command">
        <div className="expense-command-main">
          <span className="badge b-ok">financeiro do grupo</span>
          <h2>Gastos e acertos</h2>
          <p className="sub">
            Registre pagamentos compartilhados e o Planvoro mostra quem pagou demais, quem ficou
            devendo e como zerar tudo com o menor numero de transferencias.
          </p>
          <div className="expense-command-grid">
            <div>
              <span className="stat-label">Total registrado</span>
              <strong>{formatMoney(totalSpent)}</strong>
              <small>{expenses.length} lancamento{expenses.length === 1 ? "" : "s"}</small>
            </div>
            <div>
              <span className="stat-label">Voce pagou</span>
              <strong>{formatMoney(myTotals.paid)}</strong>
              <small>Saiu do seu bolso</small>
            </div>
            <div>
              <span className="stat-label">Sua parte</span>
              <strong>{formatMoney(myTotals.share)}</strong>
              <small>O que voce consumiu no rateio</small>
            </div>
            <div className={myTotals.balance >= 0 ? "positive" : "negative"}>
              <span className="stat-label">Seu saldo</span>
              <strong>
                {myTotals.balance >= 0
                  ? `+${formatMoney(myTotals.balance)}`
                  : `-${formatMoney(Math.abs(myTotals.balance))}`}
              </strong>
              <small>
                {myTotals.balance > 0.009
                  ? "Voce tem a receber"
                  : myTotals.balance < -0.009
                    ? "Voce deve ao grupo"
                    : "Voce esta zerado"}
              </small>
            </div>
          </div>
        </div>

        <BudgetAlert
          accessToken={accessToken}
          slug={slug}
          trip={trip}
          members={members}
          expenses={expenses}
          isOrganizer={me.is_organizer}
          onSaved={onSaved}
        />

        <div className="expense-command-side">
          <span className="stat-label">Estado do acerto</span>
          <strong>
            {settlementPlan.length
              ? `${settlementPlan.length} transferencia${settlementPlan.length === 1 ? "" : "s"} sugerida${settlementPlan.length === 1 ? "" : "s"}`
              : expenses.length
                ? "Tudo equilibrado"
                : "Ainda sem gastos"}
          </strong>
          <p className="tiny">
            {creditors.length} recebe{creditors.length === 1 ? "" : "m"} · {debtors.length} deve
            {debtors.length === 1 ? "" : "m"} · {settledMembers} zerado
            {settledMembers === 1 ? "" : "s"}
          </p>
          {(mySettlementsToPay.length > 0 || mySettlementsToReceive.length > 0) && (
            <div className="expense-my-actions">
              {mySettlementsToPay.map((settlement) => (
                <PixSettlementRow
                  key={`pay-${settlement.to.id}`}
                  settlement={settlement}
                  tripName={tripName}
                />
              ))}
              {mySettlementsToReceive.map((settlement) => (
                <span key={`receive-${settlement.from.id}`}>
                  {settlement.from.name} te paga {formatMoney(settlement.amount)}
                </span>
              ))}
            </div>
          )}

          <MyPixKey accessToken={accessToken} slug={slug} me={me} onSaved={onSaved} />
        </div>
      </div>

      <div className="grid2 expense-grid">
        <div className="card">
          <h2>Lancar gasto</h2>
          <p className="sub">
            Registre o que ja foi pago e deixe o saldo do grupo transparente sem sair do
            planejamento.
          </p>

          <label>Descricao</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Uber do aeroporto"
          />

          <div className="grid2 tight">
            <div>
              <label>Valor</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="89.90"
              />
            </div>
            <div>
              <label>Quem pagou</label>
              <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ marginBottom: 0 }}>Dividir com quem</label>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setSplitIds(members.map((member) => member.id))}
            >
              Selecionar todos
            </button>
          </div>
          <div className="chips">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`chip ${splitIds.includes(member.id) ? "on" : ""}`}
                onClick={() => toggleSplit(member.id)}
              >
                {member.name}
              </button>
            ))}
          </div>

          {splitPreview > 0 && (
            <div className="expense-preview">
              <span className="stat-label">Previa do rateio</span>
              <strong>{formatMoney(splitPreview)} por pessoa</strong>
              <p>
                {payerName} registra {formatMoney(Number(amount))} dividido com {splitIds.length}{" "}
                {splitIds.length === 1 ? "pessoa" : "pessoas"}.
              </p>
            </div>
          )}

          {error && <div className="err">{error}</div>}

          <button
            className="btn full"
            onClick={saveExpense}
            disabled={saving || !description.trim() || !amount || !splitIds.length || !accessToken}
          >
            {saving ? "Salvando..." : "Registrar gasto"}
          </button>
        </div>

        <div className="card">
          <div className="expense-panel-head">
            <div>
              <span className="badge b-ok">balanco</span>
              <h2>Saldo por pessoa</h2>
            </div>
            <span className="tiny">Positivo recebe · negativo paga</span>
          </div>

          {totalsByMember.map((entry) => (
            <div
              className={`balance-person ${
                entry.balance > 0.009 ? "positive" : entry.balance < -0.009 ? "negative" : "settled"
              }`}
              key={entry.member.id}
            >
              <div className="balance-person-main">
                <div className="av" style={{ background: entry.member.color }}>
                  {entry.member.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <b>
                    {entry.member.name}
                    {entry.member.id === me.id && <span className="badge b-ok">voce</span>}
                  </b>
                  <div className="tiny">
                    {formatMoney(entry.paid)} pagos · {formatMoney(entry.share)} de parte
                  </div>
                </div>
              </div>
              <div className="balance-person-side">
                <b
                  className={`balance-value ${
                    entry.balance > 0.009 ? "pos" : entry.balance < -0.009 ? "neg" : ""
                  }`}
                >
                  {entry.balance >= 0
                    ? `+${formatMoney(entry.balance)}`
                    : `-${formatMoney(Math.abs(entry.balance))}`}
                </b>
                <span>
                  {entry.balance > 0.009
                    ? "recebe"
                    : entry.balance < -0.009
                      ? "paga"
                      : "zerado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2 expense-settlement-grid">
        <div className="card expense-settlement-card">
          <div className="expense-panel-head">
            <div>
              <span className="badge b-warn">acerto sugerido</span>
              <h2>Quem paga quem</h2>
            </div>
            <span className="tiny">Baseado nos saldos atuais</span>
          </div>

          {expenses.length === 0 ? (
            <div className="note">
              <b>Sem acerto ainda</b>
              <br />
              Lance algum gasto dividido para o Planvoro montar o plano de pagamento.
            </div>
          ) : settlementPlan.length === 0 ? (
            <div className="note">
              <b>Tudo zerado</b>
              <br />
              Pelos gastos atuais, ninguem precisa transferir nada para ninguem.
            </div>
          ) : (
            <div className="settlement-list">
              {settlementPlan.map((settlement) => (
                <div className="settlement-row" key={`${settlement.from.id}-${settlement.to.id}-${settlement.amount}`}>
                  <div className="settlement-person">
                    <div className="av" style={{ background: settlement.from.color }}>
                      {settlement.from.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span>{settlement.from.name}</span>
                  </div>
                  <div className="settlement-arrow">
                    <strong>{formatMoney(settlement.amount)}</strong>
                    <span>paga para</span>
                  </div>
                  <div className="settlement-person right">
                    <div className="av" style={{ background: settlement.to.color }}>
                      {settlement.to.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span>{settlement.to.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card expense-insights-card">
          <span className="badge b-ok">leitura rapida</span>
          <h2>Radar financeiro</h2>
          <div className="expense-insight-list">
            <div>
              <strong>{creditors.length || "Ninguem"}</strong>
              <span>com saldo a receber</span>
            </div>
            <div>
              <strong>{debtors.length || "Ninguem"}</strong>
              <span>com saldo a pagar</span>
            </div>
            <div>
              <strong>{expenses.length ? formatMoney(totalSpent / Math.max(1, members.length)) : formatMoney(0)}</strong>
              <span>media registrada por pessoa no grupo</span>
            </div>
          </div>
          <p className="sub small" style={{ marginTop: 14, marginBottom: 0 }}>
            Dica: registre pagamentos reais aqui e use o Cofre para reservas/documentos. Quando a
            reserva for paga pelo grupo, lance tambem em Gastos para entrar no acerto.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Ultimos gastos</h2>
        <p className="sub">
          Cada lancamento mostra quem pagou, com quantas pessoas foi dividido e o valor por
          pessoa.
        </p>

        {expenses.length === 0 ? (
          <div className="note">
            <b>Nenhum gasto ainda</b>
            <br />
            Comece registrando transporte, hospedagem, mercado ou reservas que o grupo ja pagou.
          </div>
        ) : (
          <div className="expense-list">
            {expenses.map((expense) => {
              const total = Number(expense.amount ?? 0);
              const splitCount = expense.split_member_ids.length;
              const perPerson = splitCount ? total / splitCount : total;
              const payerName =
                members.find((member) => member.id === expense.payer_member_id)?.name ?? "alguem";

              return (
                <div className="row expense-row" key={expense.id}>
                  <div>
                    <b>{expense.description}</b>
                    <div className="tiny expense-meta">
                      {payerName} pagou · dividido com {splitCount}{" "}
                      {splitCount === 1 ? "pessoa" : "pessoas"} · {formatMoney(perPerson)}/pessoa ·{" "}
                      {formatExpenseDate(expense.created_at)}
                    </div>
                  </div>
                  <div className="expense-row-end">
                    <b>{formatMoney(total)}</b>
                    {(me.is_organizer || expense.payer_member_id === me.id) && (
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => removeExpense(expense.id)}
                        disabled={removingId === expense.id}
                        aria-label={`Remover ${expense.description}`}
                      >
                        {removingId === expense.id ? "Removendo..." : "Remover"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
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
      if (!res.ok) throw new Error(json.error ?? "Nao foi possivel mudar a visibilidade.");

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
          <h3>Vai com mais alguem?</h3>
          <p className="sub">
            Mande esse link e cada pessoa marca o que quer fazer. A IA remonta o roteiro
            equilibrando o grupo inteiro -- quem e vegetariano, quem odeia museu, quem chega
            depois.
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
        <h3>Compartilhar o roteiro</h3>
        {trip.is_public ? (
          <p className="sub">
            Link publico, sem login. Qualquer pessoa consegue abrir e ver o roteiro pronto. Cofre,
            gastos e checklist nunca aparecem ali.
          </p>
        ) : (
          <p className="sub">
            Esta viagem esta privada: quem receber o link vai encontrar uma pagina nao encontrada.
            Publique o roteiro para poder compartilhar.
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
            ficam onde estao.
          </p>
          <DuplicateTrip slug={slug} label="Duplicar viagem" />
        </div>
      </div>
    </div>
  );
}
