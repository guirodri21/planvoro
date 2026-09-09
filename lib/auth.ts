import type { SupabaseClient, User } from "@supabase/supabase-js";
import { userDisplayName } from "./user-name";

export function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const [kind, token] = header.split(" ");
  if (kind?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function getUserFromRequest(req: Request, db: SupabaseClient): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

export function displayNameFromUser(user: User, fallback?: string | null) {
  return userDisplayName(user, fallback?.trim() || "Viajante");
}
