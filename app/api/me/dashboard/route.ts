import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isProStatusActive, isTripEntitlementActive } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";

type MemberRow = {
  id: string;
  trip_id: string;
  name: string;
  is_organizer: boolean;
  created_at: string;
};

type TripRow = {
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
  created_at: string;
  view_count: number | null;
};

type SubscriptionRow = {
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type TripEntitlementRow = {
  trip_id: string;
  status: string;
  paid_at: string | null;
  access_expires_at: string | null;
};

type ItineraryRow = {
  trip_id: string;
  version: number;
  created_at: string;
};

type ExpenseRow = {
  trip_id: string;
  amount: number;
};

function countByTrip<T extends { trip_id: string }>(rows: T[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.trip_id] = (acc[row.trip_id] ?? 0) + 1;
    return acc;
  }, {});
}

function sumExpenses(rows: ExpenseRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.trip_id] = (acc[row.trip_id] ?? 0) + Number(row.amount ?? 0);
    return acc;
  }, {});
}

export async function GET(req: Request) {
  try {
    const db = supabaseAdmin();
    const user = await getUserFromRequest(req, db);

    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para ver suas viagens." }, { status: 401 });
    }

    const { data: memberships, error: membershipsError } = await db
      .from("members")
      .select("id, trip_id, name, is_organizer, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (membershipsError) throw membershipsError;

    const memberRows = (memberships ?? []) as MemberRow[];
    const tripIds = [...new Set(memberRows.map((member) => member.trip_id))];
    const { data: subscription, error: subscriptionError } = await db
      .from("user_subscriptions")
      .select("status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;

    const accountBilling = {
      subscription: (subscription ?? null) as SubscriptionRow | null,
      is_pro_active: isProStatusActive(
        subscription?.status ?? null,
        subscription?.current_period_end ?? null
      ),
    };

    if (!tripIds.length) {
      return NextResponse.json({ trips: [], account_billing: accountBilling });
    }

    const [
      tripsResult,
      memberCountsResult,
      preferenceCountsResult,
      itinerariesResult,
      expensesResult,
      entitlementsResult,
    ] = await Promise.all([
        db
          .from("trips")
          .select(
            "id, slug, destination, start_date, end_date, party_size, budget_band, styles, is_solo, is_public, created_at, view_count"
          )
          .in("id", tripIds)
          .order("created_at", { ascending: false }),
        db.from("members").select("trip_id, id").in("trip_id", tripIds),
        db.from("preferences").select("trip_id, id").in("trip_id", tripIds),
        db
          .from("itineraries")
          .select("trip_id, version, created_at")
          .in("trip_id", tripIds)
          .order("created_at", { ascending: false }),
        db.from("expenses").select("trip_id, amount").in("trip_id", tripIds),
        db
          .from("trip_entitlements")
          .select("trip_id, status, paid_at, access_expires_at")
          .in("trip_id", tripIds)
          .order("created_at", { ascending: false }),
      ]);

    if (tripsResult.error) throw tripsResult.error;
    if (memberCountsResult.error) throw memberCountsResult.error;
    if (preferenceCountsResult.error) throw preferenceCountsResult.error;
    if (itinerariesResult.error) throw itinerariesResult.error;
    if (expensesResult.error) throw expensesResult.error;
    if (entitlementsResult.error) throw entitlementsResult.error;

    const memberByTrip = Object.fromEntries(memberRows.map((member) => [member.trip_id, member]));
    const membersCountByTrip = countByTrip((memberCountsResult.data ?? []) as { trip_id: string }[]);
    const preferencesCountByTrip = countByTrip(
      (preferenceCountsResult.data ?? []) as { trip_id: string }[]
    );
    const expenseTotalByTrip = sumExpenses((expensesResult.data ?? []) as ExpenseRow[]);
    const latestItineraryByTrip = ((itinerariesResult.data ?? []) as ItineraryRow[]).reduce<
      Record<string, ItineraryRow>
    >((acc, itinerary) => {
      if (!acc[itinerary.trip_id]) acc[itinerary.trip_id] = itinerary;
      return acc;
    }, {});
    const entitlementByTrip = ((entitlementsResult.data ?? []) as TripEntitlementRow[]).reduce<
      Record<string, TripEntitlementRow>
    >((acc, entitlement) => {
      if (!acc[entitlement.trip_id] || entitlement.status === "paid") {
        acc[entitlement.trip_id] = entitlement;
      }
      return acc;
    }, {});

    const trips = ((tripsResult.data ?? []) as TripRow[]).map((trip) => ({
      ...trip,
      viewer_member: memberByTrip[trip.id] ?? null,
      members_count: membersCountByTrip[trip.id] ?? 0,
      preferences_count: preferencesCountByTrip[trip.id] ?? 0,
      expenses_total: expenseTotalByTrip[trip.id] ?? 0,
      latest_itinerary: latestItineraryByTrip[trip.id] ?? null,
      billing: entitlementByTrip[trip.id]
        ? {
            ...entitlementByTrip[trip.id],
            is_paid: isTripEntitlementActive(
              entitlementByTrip[trip.id].status,
              entitlementByTrip[trip.id].access_expires_at
            ),
          }
        : null,
    }));

    return NextResponse.json({ trips, account_billing: accountBilling });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar suas viagens.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
