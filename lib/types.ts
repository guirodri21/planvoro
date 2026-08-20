export type Trip = {
  id: string;
  slug: string;
  destination: string;
  start_date: string;
  end_date: string;
  party_size: number;
  budget_band: string | null;
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
  "Musica ao vivo",
  "Esportes",
];

export const RESTRICTIONS = [
  "Vegetariano",
  "Vegano",
  "Sem gluten",
  "Sem alcool",
  "Mobilidade reduzida",
  "Nao acordo cedo",
  "Viajando com crianca",
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
  "Ate R$ 3.000",
  "R$ 3.000 - R$ 5.000",
  "R$ 5.000 - R$ 8.000",
  "Acima de R$ 8.000",
];

export const DAILY_BUDGETS = [
  "Ate R$ 250/dia",
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

/** Rotulos das reacoes. O valor e o que vai pro banco. */
export const REACTIONS = [
  { value: 1, emoji: "\u{1F44D}", label: "curti" },
  { value: 0, emoji: "\u{1F914}", label: "na duvida" },
  { value: -1, emoji: "\u{1F44E}", label: "nao curti" },
] as const;
