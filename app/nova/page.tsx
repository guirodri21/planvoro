"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { useAuth } from "@/components/auth-provider";
import { BUDGET_BANDS, DAILY_BUDGETS, INTERESTS, RESTRICTIONS, STYLES } from "@/lib/types";
import { userDisplayName } from "@/lib/user-name";
import { track } from "@/lib/analytics";

type TripKind = "solo" | "couple" | "friends" | "family" | "work";
type SubmitPhase = "idle" | "creating" | "preferences" | "generating" | "opening";

const STEPS = [
  "Destino",
  "Datas",
  "Quem vai",
  "Orçamento",
  "Interesses",
  "Ritmo",
  "Resumo",
] as const;

const TRIP_KINDS: Array<{
  id: TripKind;
  label: string;
  description: string;
  partySize: number;
}> = [
  {
    id: "solo",
    label: "Só eu",
    description: "Roteiro direto, focado no seu ritmo.",
    partySize: 1,
  },
  {
    id: "couple",
    label: "Casal",
    description: "Preferências compartilhadas e clima mais leve.",
    partySize: 2,
  },
  {
    id: "friends",
    label: "Grupo de amigos",
    description: "Votos, ideias e orçamento sem caos no WhatsApp.",
    partySize: 6,
  },
  {
    id: "family",
    label: "Família",
    description: "Mais conforto, pausas e logística realista.",
    partySize: 4,
  },
  {
    id: "work",
    label: "Trabalho",
    description: "Agenda objetiva com deslocamentos bem pensados.",
    partySize: 5,
  },
];

const PACE_OPTIONS = [
  {
    label: "Tranquilo",
    description: "Poucas atividades, pausas e tempo livre.",
  },
  {
    label: "Equilibrado",
    description: "Um bom roteiro sem virar maratona.",
  },
  {
    label: "Intenso",
    description: "Mais atividades por dia, para aproveitar tudo.",
  },
];

const EXTRA_RESTRICTIONS = [
  "Pouco deslocamento",
  "Opção para chuva",
  "Viagem com idoso",
  "Pet friendly",
  "Sem luxo desnecessário",
];

const ALL_RESTRICTIONS = [...RESTRICTIONS, ...EXTRA_RESTRICTIONS];

const TRIP_KIND_LABEL: Record<TripKind, string> = {
  solo: "Só eu",
  couple: "Casal",
  friends: "Grupo de amigos",
  family: "Família",
  work: "Trabalho",
};

const creationSteps: Array<{ phase: SubmitPhase; label: string; description: string }> = [
  {
    phase: "creating",
    label: "Criar workspace",
    description: "Abrindo a viagem e vinculando você como organizador.",
  },
  {
    phase: "preferences",
    label: "Salvar preferências",
    description: "Guardando interesses, ritmo, orçamento e restrições.",
  },
  {
    phase: "generating",
    label: "Gerar primeiro roteiro",
    description: "Montando uma versão inicial para você ajustar no Planvoro.",
  },
  {
    phase: "opening",
    label: "Abrir central da viagem",
    description: "Levando você para o painel com Agenda, Cofre, Checklist e Gastos.",
  },
];

const previewDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function formatPreviewDate(value: string) {
  if (!value) return "definir";
  return previewDateFormatter.format(new Date(`${value}T12:00:00`));
}

function tripDuration(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export default function NovaViagem() {
  const router = useRouter();
  const { session, user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    organizer_name: "",
    destination: "",
    start_date: "",
    end_date: "",
    party_size: 6,
    budget_band: BUDGET_BANDS[1],
    daily_budget: DAILY_BUDGETS[1],
    trip_kind: "friends" as TripKind,
    pace: "Equilibrado",
  });
  const [styles, setStyles] = useState<string[]>(["Gastronomia", "Cultura"]);
  const [interests, setInterests] = useState<string[]>([
    "Restaurantes locais",
    "Museus",
    "Mercados",
  ]);
  const [restrictions, setRestrictions] = useState<string[]>([]);

  const selectedKind = TRIP_KINDS.find((kind) => kind.id === form.trip_kind) ?? TRIP_KINDS[2];
  const isSubmitting = phase !== "idle";
  const isSolo = form.trip_kind === "solo";
  const durationDays = tripDuration(form.start_date, form.end_date);
  const essentialsDone = [
    form.organizer_name.trim().length >= 2,
    form.destination.trim().length >= 2,
    Boolean(form.start_date && form.end_date && durationDays > 0),
    Boolean(form.budget_band && form.daily_budget),
    interests.length > 0,
    styles.length > 0,
  ].filter(Boolean).length;
  const readiness = Math.round((essentialsDone / 6) * 100);
  const selectedSignals = [...interests, ...styles, ...restrictions].slice(0, 8);

  useEffect(() => {
    if (!user) return;
    setForm((prev) =>
      prev.organizer_name
        ? prev
        : {
            ...prev,
            organizer_name: userDisplayName(user),
          }
    );
  }, [user]);

  function updateForm(next: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function toggleValue(value: string, setter: (next: string[]) => void, current: string[]) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function selectKind(kind: TripKind) {
    const config = TRIP_KINDS.find((item) => item.id === kind);
    updateForm({
      trip_kind: kind,
      party_size: config?.partySize ?? form.party_size,
    });
  }

  function currentStepValid() {
    if (step === 0) {
      return form.organizer_name.trim().length >= 2 && form.destination.trim().length >= 2;
    }
    if (step === 1) {
      return (
        Boolean(form.start_date) &&
        Boolean(form.end_date) &&
        new Date(form.end_date) >= new Date(form.start_date)
      );
    }
    if (step === 2) {
      return isSolo || (Number.isFinite(form.party_size) && form.party_size >= 2);
    }
    if (step === 3) {
      return Boolean(form.budget_band && form.daily_budget);
    }
    if (step === 4) {
      return interests.length > 0 && styles.length > 0;
    }
    return true;
  }

  function goNext() {
    if (!currentStepValid()) return;
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit() {
    if (!session?.access_token || isSubmitting) return;

    setError("");
    setPhase("creating");

    try {
      const createRes = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          organizer_name: form.organizer_name,
          destination: form.destination,
          start_date: form.start_date,
          end_date: form.end_date,
          party_size: isSolo ? 1 : form.party_size,
          budget_band: form.budget_band,
          is_solo: isSolo,
          styles: [...styles, `Tipo: ${TRIP_KIND_LABEL[form.trip_kind]}`, `Ritmo: ${form.pace}`],
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Não foi possível criar a viagem.");

      const slug = String(created.slug);
      track("viagem_criada", {
        slug,
        solo: isSolo,
        pessoas: isSolo ? 1 : form.party_size,
        dias:
          (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000 + 1,
      });

      setPhase("preferences");
      await fetch(`/api/trips/${slug}/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          interests,
          restrictions: [...restrictions, `Ritmo: ${form.pace}`],
          daily_budget: form.daily_budget,
          present_from: form.start_date,
          present_to: form.end_date,
        }),
      });

      setPhase("generating");
      await fetch(`/api/trips/${slug}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => null);

      setPhase("opening");
      router.push(`/v/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado ao criar a viagem.");
      setPhase("idle");
    }
  }

  if (authLoading) {
    return <div className="card muted">Carregando sua conta...</div>;
  }

  if (!user || !session?.access_token) {
    return (
      <AuthRequiredCard
        title="Entre antes de criar a viagem"
        description="Sua conta vai guardar o papel de organizador, suas preferências e o histórico das viagens que você abrir."
        nextPath="/nova"
      />
    );
  }

  return (
    <div className="wizard-shell">
      <div className="wizard-hero">
        <p className="eyebrow">Nova viagem</p>
        <h1>Monte a base da viagem antes da IA começar.</h1>
        <p className="sub">
          Um onboarding curto, com preview vivo do plano. Quando você confirma, o Planvoro abre o
          workspace com roteiro inicial, preferências salvas e próximos passos para organizar o grupo.
        </p>
      </div>

      <WizardProgress step={step} />

      <div className="wizard-layout">
        <section className="wizard-card">
          {step === 0 && (
            <WizardPanel title="Para onde você vai?" description="Comece pelo básico. Você pode editar tudo depois.">
              <label>Seu nome</label>
              <input
                value={form.organizer_name}
                placeholder="Guilherme"
                onChange={(event) => updateForm({ organizer_name: event.target.value })}
              />

              <label>Destino</label>
              <input
                autoFocus
                value={form.destination}
                placeholder="Lisboa, Portugal"
                onChange={(event) => updateForm({ destination: event.target.value })}
              />
            </WizardPanel>
          )}

          {step === 1 && (
            <WizardPanel title="Quando vai ser?" description="As datas ajudam a IA a montar os dias do roteiro.">
              <div className="grid2 tight">
                <div>
                  <label>Ida</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) => updateForm({ start_date: event.target.value })}
                  />
                </div>
                <div>
                  <label>Volta</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(event) => updateForm({ end_date: event.target.value })}
                  />
                </div>
              </div>
              {form.start_date && form.end_date && new Date(form.end_date) < new Date(form.start_date) && (
                <div className="err">A volta não pode ser antes da ida.</div>
              )}
            </WizardPanel>
          )}

          {step === 2 && (
            <WizardPanel title="Quem vai?" description="Isso muda o jeito de pensar ritmo, votação e convite.">
              <div className="option-grid">
                {TRIP_KINDS.map((kind) => (
                  <button
                    key={kind.id}
                    type="button"
                    className={`option-card ${form.trip_kind === kind.id ? "on" : ""}`}
                    onClick={() => selectKind(kind.id)}
                  >
                    <strong>{kind.label}</strong>
                    <span>{kind.description}</span>
                  </button>
                ))}
              </div>

              {!isSolo && (
                <>
                  <label>Número aproximado de pessoas</label>
                  <input
                    type="number"
                    min={2}
                    max={40}
                    value={form.party_size}
                    onChange={(event) => updateForm({ party_size: Number(event.target.value) })}
                  />
                </>
              )}
            </WizardPanel>
          )}

          {step === 3 && (
            <WizardPanel title="Qual é o orçamento?" description="Pode ser uma faixa aproximada. A IA usa isso como guardrail.">
              <label>Orçamento total {isSolo ? "" : "por pessoa"} sem passagem</label>
              <select
                value={form.budget_band}
                onChange={(event) => updateForm({ budget_band: event.target.value })}
              >
                {BUDGET_BANDS.map((budget) => (
                  <option key={budget}>{budget}</option>
                ))}
              </select>

              <label>Gasto diário confortável</label>
              <select
                value={form.daily_budget}
                onChange={(event) => updateForm({ daily_budget: event.target.value })}
              >
                {DAILY_BUDGETS.map((budget) => (
                  <option key={budget}>{budget}</option>
                ))}
              </select>
            </WizardPanel>
          )}

          {step === 4 && (
            <WizardPanel title="O que não pode faltar?" description="Escolha interesses e estilo geral da viagem.">
              <label>Interesses</label>
              <div className="chips">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    className={`chip ${interests.includes(interest) ? "on" : ""}`}
                    onClick={() => toggleValue(interest, setInterests, interests)}
                  >
                    {interest}
                  </button>
                ))}
              </div>

              <label>Estilo da viagem</label>
              <div className="chips">
                {STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`chip ${styles.includes(style) ? "on" : ""}`}
                    onClick={() => toggleValue(style, setStyles, styles)}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </WizardPanel>
          )}

          {step === 5 && (
            <WizardPanel title="Alguma restrição ou ritmo preferido?" description="Essa parte evita roteiro bonito que não cabe na vida real.">
              <label>Ritmo</label>
              <div className="option-grid pace-grid">
                {PACE_OPTIONS.map((pace) => (
                  <button
                    key={pace.label}
                    type="button"
                    className={`option-card ${form.pace === pace.label ? "on" : ""}`}
                    onClick={() => updateForm({ pace: pace.label })}
                  >
                    <strong>{pace.label}</strong>
                    <span>{pace.description}</span>
                  </button>
                ))}
              </div>

              <label>Restrições e cuidados</label>
              <div className="chips">
                {ALL_RESTRICTIONS.map((restriction) => (
                  <button
                    key={restriction}
                    type="button"
                    className={`chip ${restrictions.includes(restriction) ? "on" : ""}`}
                    onClick={() => toggleValue(restriction, setRestrictions, restrictions)}
                  >
                    {restriction}
                  </button>
                ))}
              </div>
            </WizardPanel>
          )}

          {step === 6 && (
            <WizardPanel title="Tudo pronto para lançar?" description="Confira o plano. Depois abrimos a central completa da viagem.">
              <div className="summary-grid">
                <SummaryItem label="Destino" value={form.destination || "Não informado"} />
                <SummaryItem label="Datas" value={`${form.start_date || "ida"} até ${form.end_date || "volta"}`} />
                <SummaryItem label="Quem vai" value={`${selectedKind.label} · ${isSolo ? 1 : form.party_size} pessoa(s)`} />
                <SummaryItem label="Orçamento" value={`${form.budget_band} · ${form.daily_budget}`} />
                <SummaryItem label="Ritmo" value={form.pace} />
                <SummaryItem label="Interesses" value={[...interests, ...styles].slice(0, 6).join(", ")} />
              </div>

              <div className="launch-preview">
                <div className="launch-preview-head">
                  <span className="badge b-ok">workspace pronto</span>
                  <strong>O que nasce depois do clique</strong>
                </div>
                <div className="launch-preview-grid">
                  <div>
                    <span>01</span>
                    <strong>Roteiro inicial</strong>
                    <p>Uma primeira versão gerada por IA com seus interesses, orçamento e ritmo.</p>
                  </div>
                  <div>
                    <span>02</span>
                    <strong>Central de comando</strong>
                    <p>Resumo executivo, Checklist, Agenda, Cofre, Ideias, Agente e Gastos.</p>
                  </div>
                  <div>
                    <span>03</span>
                    <strong>Convite do grupo</strong>
                    <p>Link para outras pessoas entrarem, votarem e preencherem preferências.</p>
                  </div>
                </div>
              </div>

              <div className="note">
                <b>Depois que abrir</b>
                <br />
                O ideal é conferir o roteiro, guardar passagens/hotel no Cofre e convidar o grupo
                para completar preferências antes de fechar reservas.
              </div>
            </WizardPanel>
          )}

          {error && <div className="err">{error}</div>}

          <div className="wizard-actions">
            <button className="btn ghost" type="button" onClick={goBack} disabled={step === 0 || isSubmitting}>
              Voltar
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn" type="button" onClick={goNext} disabled={!currentStepValid() || isSubmitting}>
                Continuar
              </button>
            ) : (
              <button className="btn" type="button" onClick={submit} disabled={isSubmitting}>
                {phase === "creating"
                  ? "Criando viagem..."
                  : phase === "preferences"
                    ? "Salvando preferências..."
                    : phase === "generating"
                      ? "Gerando roteiro..."
                      : phase === "opening"
                        ? "Abrindo workspace..."
                        : "Gerar roteiro com IA"}
              </button>
            )}
          </div>
        </section>

        <aside className="wizard-aside">
          <TripPlanPreview
            destination={form.destination}
            startDate={form.start_date}
            endDate={form.end_date}
            durationDays={durationDays}
            tripKind={selectedKind.label}
            partySize={isSolo ? 1 : form.party_size}
            budget={`${form.budget_band} · ${form.daily_budget}`}
            pace={form.pace}
            readiness={readiness}
            signals={selectedSignals}
            phase={phase}
          />
        </aside>
      </div>
    </div>
  );
}

function TripPlanPreview({
  destination,
  startDate,
  endDate,
  durationDays,
  tripKind,
  partySize,
  budget,
  pace,
  readiness,
  signals,
  phase,
}: {
  destination: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  tripKind: string;
  partySize: number;
  budget: string;
  pace: string;
  readiness: number;
  signals: string[];
  phase: SubmitPhase;
}) {
  const currentPhaseIndex = creationSteps.findIndex((item) => item.phase === phase);
  const isCreating = phase !== "idle";

  return (
    <div className="plan-preview">
      <span className="badge b-ok">{isCreating ? "criando agora" : "preview ao vivo"}</span>
      <h2>{destination || "Sua próxima viagem"}</h2>
      <p className="small">
        {durationDays
          ? `${formatPreviewDate(startDate)} até ${formatPreviewDate(endDate)} · ${durationDays} dia${durationDays === 1 ? "" : "s"}`
          : "Defina destino e datas para ver o plano ganhar forma."}
      </p>

      <div className="plan-readiness">
        <div>
          <span className="stat-label">Prontidão</span>
          <strong>{readiness}%</strong>
        </div>
        <div className="progress-line">
          <span style={{ width: `${readiness}%` }} />
        </div>
      </div>

      <div className="plan-preview-grid">
        <div>
          <span className="stat-label">Tipo</span>
          <strong>{tripKind}</strong>
        </div>
        <div>
          <span className="stat-label">Pessoas</span>
          <strong>{partySize}</strong>
        </div>
        <div>
          <span className="stat-label">Ritmo</span>
          <strong>{pace}</strong>
        </div>
        <div>
          <span className="stat-label">Orçamento</span>
          <strong>{budget}</strong>
        </div>
      </div>

      {signals.length > 0 && (
        <div className="plan-signal-cloud">
          {signals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
      )}

      <div className="creation-roadmap">
        {creationSteps.map((item, index) => {
          const done = currentPhaseIndex > index || phase === "opening";
          const active = currentPhaseIndex === index;
          return (
            <div className={`creation-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={item.phase}>
              <span>{done ? "✓" : index + 1}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WizardProgress({ step }: { step: number }) {
  return (
    <div className="wizard-progress" aria-label="Progresso de criação da viagem">
      {STEPS.map((label, index) => (
        <div className={`wizard-step ${index <= step ? "on" : ""}`} key={label}>
          <span>{index + 1}</span>
          <b>{label}</b>
        </div>
      ))}
    </div>
  );
}

function WizardPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="wizard-panel">
      <div>
        <h2>{title}</h2>
        <p className="sub">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
