import type { User } from "@supabase/supabase-js";

type MinimalUser = Pick<User, "email" | "user_metadata"> | null | undefined;

export function userDisplayName(user: MinimalUser, fallback = "Viajante") {
  const metadataName =
    typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  if (metadataName) return metadataName;

  const emailName = user?.email?.split("@")[0]?.trim();
  if (emailName) return emailName;

  return fallback;
}
