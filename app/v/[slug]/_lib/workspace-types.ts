/**
 * Tipos que so existem dentro do workspace da viagem.
 *
 * Sao formatos de tela e de resposta de rota, nao entidades do dominio —
 * por isso ficam aqui e nao em lib/types.ts, que descreve o que existe no
 * banco.
 */

import type {
  Comment,
  Expense,
  Idea,
  IdeaVote,
  Itinerary,
  Member,
  Preference,
  Trip,
  TripChecklistItem,
  TripVaultAttachment,
  TripVaultItem,
  TripVaultKind,
  TripVaultStatus,
  Vote,
} from "@/lib/types";

/** Tudo que GET /api/trips/[slug] devolve. */
export type Payload = {
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

export type WorkspaceTab =
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

/** Uma linha da agenda: vem do roteiro ou do Cofre, exibida igual. */
export type TravelTimelineEntry = {
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

export type AgentReply = {
  answer: string;
  next_steps: string[];
  watchouts: string[];
};

export type GenerationProgress = {
  diasGerados: number;
  diasTotais: number;
};

export type GenerateResponse = {
  ok?: boolean;
  error?: string;
  concluido?: boolean;
  dias_gerados?: number;
  dias_totais?: number;
};

/** Rascunho que a IA devolve ao ler uma confirmacao. Nada e salvo sem revisao. */
export type VaultImportDraft = {
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

export type VaultImportResult = Pick<
  VaultImportDraft,
  "confidence" | "missing_fields" | "summary"
>;

/** Teto de anexos que o formulario segura antes de o item existir. */
export const MAX_PENDING_ATTACHMENTS = 12;

export const IDEA_CATEGORIES = [
  "Restaurante",
  "Passeio",
  "Praia",
  "Hospedagem",
  "Transporte",
  "Noite",
  "Compras",
  "Outro",
];

export const AGENT_PROMPTS = [
  "O que falta decidir antes dessa viagem?",
  "Como deixar esse roteiro mais barato sem perder qualidade?",
  "O roteiro está corrido demais? Onde você ajustaria?",
  "Quais reservas eu deveria fazer primeiro?",
  "Que mensagem eu mando para alinhar o grupo?",
];
