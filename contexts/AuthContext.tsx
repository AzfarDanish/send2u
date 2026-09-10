import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { DEV_AUTH_ENABLED } from '@/config/dev';
import { isSupabaseConfigured } from '@/config/env';
import { getSupabaseClient } from '@/lib/supabase';
import {
  continueAsDev,
  fetchProfile,
  getActiveSession,
  onAuthStateChange,
  setProfileRole,
  signOut as signOutService,
  switchDevRole,
} from '@/services/auth';
import type { AppUser, Profile, UserRole } from '@/types/domain';

interface AuthContextValue {
  session: Session | null;
  user: AppUser | null;
  profile: Profile | null;
  /** App-routing role, derived from the Supabase profile row. */
  role: UserRole | null;
  /** True until the initial session + profile restore completes. */
  isLoading: boolean;
  isSupabaseEnabled: boolean;
  devAuthEnabled: boolean;
  /** Last restore error (e.g. network), if any. Cleared on next success. */
  authError: string | null;
  /** Dev-only entry: real anonymous session + profile role. No credentials. */
  continueAs: (role: UserRole) => Promise<void>;
  /** Dev-only role switch for the signed-in user. No credentials. */
  switchRole: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAppUser(user: User, profile: Profile | null): AppUser {
  const role = profile?.role === 'requester' || profile?.role === 'helper' ? profile.role : null;
  return {
    id: user.id,
    email: user.email ?? null,
    role,
    isAnonymous: (user.is_anonymous ?? false) === true,
  };
}

function requireDevAuth(): void {
  if (!DEV_AUTH_ENABLED) {
    throw new Error('Development auth is disabled in this build.');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initial restore: session first, then the profile row for auth.uid().
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        if (!getSupabaseClient()) {
          if (mounted) setIsLoading(false);
          return;
        }
        const active = await getActiveSession();
        if (!mounted) return;
        setSession(active?.session ?? null);
        setAuthUser(active?.user ?? null);
        if (active) {
          const restored = await fetchProfile(active.user.id);
          if (mounted) setProfile(restored);
        }
        unsubscribe = onAuthStateChange(async (nextSession) => {
          if (!mounted) return;
          setSession(nextSession);
          setAuthUser(nextSession?.user ?? null);
          if (!nextSession) {
            setProfile(null);
            return;
          }
          try {
            const nextProfile = await fetchProfile(nextSession.user.id);
            if (mounted) {
              setProfile(nextProfile);
              setAuthError(null);
            }
          } catch (error) {
            if (mounted) {
              setAuthError(error instanceof Error ? error.message : 'Could not load profile.');
            }
          }
        });
        if (mounted) setAuthError(null);
      } catch (error) {
        if (mounted) {
          setAuthError(error instanceof Error ? error.message : 'Could not restore session.');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const continueAs = useCallback(
    async (role: UserRole) => {
      requireDevAuth();
      // A restored session means identity already exists: only the role
      // changes. This path can never mint a new anonymous user.
      if (authUser) {
        const nextProfile = await setProfileRole(authUser.id, role);
        setProfile(nextProfile);
        setAuthError(null);
        return;
      }
      const { user, profile: nextProfile } = await continueAsDev(role);
      setAuthUser(user);
      setProfile(nextProfile);
      setAuthError(null);
      // The session object also arrives via onAuthStateChange; fetch it
      // directly so state is consistent even if the event races this update.
      const active = await getActiveSession();
      setSession(active?.session ?? null);
    },
    [authUser],
  );

  const switchRole = useCallback(async (role: UserRole) => {
    requireDevAuth();
    const nextProfile = await switchDevRole(role);
    setProfile(nextProfile);
    setAuthError(null);
  }, []);

  const signOut = useCallback(async () => {
    await signOutService();
    setSession(null);
    setAuthUser(null);
    setProfile(null);
    setAuthError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!authUser) return;
    const nextProfile = await fetchProfile(authUser.id);
    setProfile(nextProfile);
  }, [authUser]);

  const value = useMemo<AuthContextValue>(() => {
    const user = authUser ? toAppUser(authUser, profile) : null;
    return {
      session,
      user,
      profile,
      role: user?.role ?? null,
      isLoading,
      // Pure env check (no client creation) so render/SSR stays side-effect free.
      isSupabaseEnabled: isSupabaseConfigured(),
      devAuthEnabled: DEV_AUTH_ENABLED,
      authError,
      continueAs,
      switchRole,
      signOut,
      refreshProfile,
    };
  }, [session, authUser, profile, isLoading, authError, continueAs, switchRole, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
