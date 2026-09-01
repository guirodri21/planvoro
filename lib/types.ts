export type Trip = {
  id: string;
  slug: string;
  destination: string;
  start_date: string;
  end_date: string;
  party_size: number;
  budget_band: string | null;
  /** Teto por pessoa, em BRL. Base dos alertas de orcamento. */
  budget_per_person?: number | null;
  styles: string[];
  is_solo: boolean;
  is_public: boolean;
};

export type Member = {
  id: string;
  trip_id: string;
  name: string;
  is_organizer: boolean;
  color: string;
  /** Chave Pix para receber o acerto. Exibida ao grupo, nunca validada. */
  pix_key?: string | null;
  /** Cidade do recebedor, campo obrigatorio do BR Code. */
  pix_city?: string | null;
};

export type Preference = {
  id: string;
  member_id: string;
  interests: string[];
  restrictions: string[];
  daily_budget: string | null;
  present_from: string | null;
  present_to: string | null;
};

export type Item = {
  id: string;
  position: number;
  start_time: string | null;
  duration_min: number | null;
  title: string;
  description: string | null;
  category: string | null;
  cost_estimate: number | null;
  place_query: string | null;
  verified: boolean;
  lat: number | null;
  lng: number | null;
  needs_vote: boolean;
};

export type Day = {
  id: string;
  day_date: string;
  title: string | null;
  note: string | null;
  position: number;
  itinerary_items: Item[];
};

export type Itinerary = {
  id: string;
  version: number;
  rationale: string | null;
  itinerary_days: Day[];
};

export const INTERESTS = [
  "Restaurantes locais",
  "Museus",
  "Bares e vida noturna",
  "Trilha e natureza",
  "Praia",
  "Mercados",
  "Arquitetura",
  "Compras",
  "Música ao vivo",
  "Esportes",
];

export const RESTRICTIONS = [
  "Vegetariano",
  "Vegano",
  "Sem glúten",
  "Sem álcool",
  "Mobilidade reduzida",
  "Não acordo cedo",
  "Viajando com criança",
];

export const STYLES = [
  "Gastronomia",
  "Cultura",
  "Praia",
  "Vida noturna",
  "Natureza",
  "Compras",
  "Relaxar",
  "Aventura",
];

export const BUDGET_BANDS = [
  "Até R$ 3.000",
  "R$ 3.000 - R$ 5.000",
  "R$ 5.000 - R$ 8.000",
  "Acima de R$ 8.000",
];

export const DAILY_BUDGETS = [
  "Até R$ 250/dia",
  "R$ 250 - R$ 450/dia",
  "R$ 450 - R$ 700/dia",
  "Acima de R$ 700/dia",
];

export type Vote = {
  item_id: string;
  member_id: string;
  value: number;
};

export type Comment = {
  id: string;
  item_id: string;
  member_id: string;
  body: string;
  created_at: string;
};

export type Expense = {
  id: string;
  trip_id: string;
  payer_member_id: string;
  amount: number;
  description: string;
  split_member_ids: string[];
  created_at: string;
};

export type TripVaultKind =
  | "flight"
  | "lodging"
  | "activity"
  | "transport"
  | "insurance"
  | "visa"
  | "restaurant"
  | "document"
  | "other";

export type TripVaultStatus = "saved" | "reserved" | "paid" | "attention" | "canceled";

export type TripVaultItem = {
  id: string;
  trip_id: string;
  member_id: string | null;
  kind: TripVaultKind;
  title: string;
  provider: string | null;
  confirmation_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  amount: number | null;
  currency: string;
  status: TripVaultStatus;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TripVaultAttachment = {
  id: string;
  trip_id: string;
  item_id: string;
  member_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export const TRIP_VAULT_KINDS: Array<{ value: TripVaultKind; label: string; hint: string }> = [
  { value: "flight", label: "Passagem / voo", hint: "Localizador, horários, aeroporto" },
  { value: "lodging", label: "Hospedagem", hint: "Hotel, Airbnb, check-in" },
  { value: "activity", label: "Passeio / ingresso", hint: "Tour, atração, evento" },
  { value: "transport", label: "Transporte", hint: "Carro, trem, transfer, ônibus" },
  { value: "insurance", label: "Seguro", hint: "Apólice, cobertura, contato" },
  { value: "visa", label: "Visto / documento", hint: "Regras, prazos, protocolos" },
  { value: "restaurant", label: "Restaurante", hint: "Reserva, horário, endereço" },
  { value: "document", label: "Documento / link", hint: "PDF, pasta, comprovante" },
  { value: "other", label: "Outro", hint: "Qualquer item importante" },
];

export const TRIP_VAULT_STATUSES: Array<{ value: TripVaultStatus; label: string }> = [
  { value: "saved", label: "Salvo" },
  { value: "reserved", label: "Reservado" },
  { value: "paid", label: "Pago" },
  { value: "attention", label: "Precisa conferir" },
  { value: "canceled", label: "Cancelado" },
];

export type TripChecklistCategory =
  | "booking"
  | "documents"
  | "money"
  | "packing"
  | "group"
  | "transport"
  | "health"
  | "planning"
  | "other";

export type TripChecklistStatus = "open" | "done" | "skipped";

export type TripChecklistItem = {
  id: string;
  trip_id: string;
  member_id: string | null;
  category: TripChecklistCategory;
  title: string;
  notes: string | null;
  due_date: string | null;
  status: TripChecklistStatus;
  source: "manual" | "suggested";
  created_at: string;
  updated_at: string;
};

export const TRIP_CHECKLIST_CATEGORIES: Array<{
  value: TripChecklistCategory;
  label: string;
}> = [
  { value: "booking", label: "Reservas" },
  { value: "documents", label: "Documentos" },
  { value: "money", label: "Dinheiro" },
  { value: "packing", label: "Mala" },
  { value: "group", label: "Grupo" },
  { value: "transport", label: "Transporte" },
  { value: "health", label: "Saude" },
  { value: "planning", label: "Planejamento" },
  { value: "other", label: "Outro" },
];

export const TRIP_CHECKLIST_STATUSES: Array<{ value: TripChecklistStatus; label: string }> = [
  { value: "open", label: "Pendente" },
  { value: "done", label: "Feito" },
  { value: "skipped", label: "Ignorado" },
];

export type IdeaStatus = "open" | "planned" | "dismissed";

export type Idea = {
  id: string;
  trip_id: string;
  member_id: string;
  title: string;
  notes: string | null;
  category: string | null;
  estimated_cost: number | null;
  status: IdeaStatus;
  created_at: string;
  updated_at: string;
};

export type IdeaVote = {
  idea_id: string;
  member_id: string;
  value: number;
};

/** Rótulos das reações. O valor é o que vai para o banco. */
export const REACTIONS = [
  { value: 1, emoji: "\u{1F44D}", label: "curti" },
  { value: 0, emoji: "\u{1F914}", label: "na dúvida" },
  { value: -1, emoji: "\u{1F44E}", label: "não curti" },
] as const;
