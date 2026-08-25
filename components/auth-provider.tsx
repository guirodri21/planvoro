"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

const SESSION_REFRESH_MARGIN_MS = 5 * 60 * 1000;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const client = supabaseBrowser();

    if (!client) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    const authClient = client;

    async function loadStoredSession() {
      try {
        const { data, error } = await authClient.auth.getSession();
        if (error) throw error;

        let nextSession = data.session;
        const expiresAt = nextSession?.expires_at ? nextSession.expires_at * 1000 : null;

        if (nextSession && (!expiresAt || expiresAt - Date.now() < SESSION_REFRESH_MARGIN_MS)) {
          const { data: refreshed, error: refreshError } = await authClient.auth.refreshSession();
          if (!refreshError) {
            nextSession = refreshed.session ?? nextSession;
          }
        }

        if (!alive) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      } catch {
        if (!alive) return;
        setSession(null);
        setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadStoredSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const client = supabaseBrowser();
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return ctx;
}
