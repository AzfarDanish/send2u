import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { DEV_AUTH_ENABLED } from '@/config/dev';
import { isSupabaseConfigured } from '@/config/env';
import { getSupabaseClient } from '@/lib/supabase';
import {
  claimMissingProfile as claimMissingProfileService,
  fetchProfile,
  getActiveSession,
  onAuthStateChange,
  signInWithPassword,
  signOut as signOutService,
  signUpAccount,
  type SignUpResult,
} from '@/services/auth';
import type { AppUser, Profile, UserRole } from '@/types/domain';

interface AuthContextValue {
  session: Session | null;
  user: AppUser | null;
  profile: Profile | null;
  /** App-routing role, derived from the Supabase profile row. */
  role: UserRole | null;
  /** Verified Helper Portal capability (requester + flag). Independent of role. */
  isVerifiedHelper: boolean;
  /** True until the initial session + profile restore completes. */
  isLoading: boolean;
  isSupabaseEnabled: boolean;
  /** Gates dev-only UI (the test-account switcher). Never a prod capability. */
  devAuthEnabled: boolean;
  /** Last restore error (e.g. network), if any. Cleared on next success. */
  authError: string | null;
  /** Real account signup with a permanent role. Returns the signup outcome. */
  signUp: (email: string, password: string, role: UserRole) => Promise<SignUpResult>;
  /** Real account login. */
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * One-time repair for accounts with no profile row. INSERT-only — it throws
   * when a profile already exists, so it can never change a role.
   */
  claimMissingProfile: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /**
   * Replaces shared profile state with the authoritative row returned by a
   * mutation (Edit Profile, avatar change). No refetch; the whole app —
   * Profile, Settings, headers — sees the new values immediately.
   */
  updateProfile: (next: Profile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAppUser(user: User, profile: Profile | null): AppUser {
  // Vendor accounts pass through like requester/helper; admin stays
  // role-less (no admin UI exists). Role itself remains server-immutable.
  const role =
    profile?.role === 'requester' || profile?.role === 'helper' || profile?.role === 'vendor'
      ? profile.role
      : null;
  return {
    id: user.id,
    email: user.email ?? null,
    role,
    isAnonymous: (user.is_anonymous ?? false) === true,
    isVerifiedHelper: profile?.isVerifiedHelper ?? false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initial restore: session first, then the profile row for auth.uid().
  // Legacy anonymous sessions are signed out: the app only admits real
  // accounts, and keeping a stale anon identity would strand the user on a
  // role-less session with no upgrade path.
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    const clearToSignedOut = () => {
      setSession(null);
      setAuthUser(null);
      setProfile(null);
    };
    (async () => {
      try {
        if (!getSupabaseClient()) {
          if (mounted) setIsLoading(false);
          return;
        }
        const active = await getActiveSession();
        if (!mounted) return;
        if (active && active.user.is_anonymous) {
          await signOutService().catch(() => {});
          if (mounted) clearToSignedOut();
        } else {
          setSession(active?.session ?? null);
          setAuthUser(active?.user ?? null);
          if (active) {
            const restored = await fetchProfile(active.user.id);
            if (mounted) setProfile(restored);
          }
        }
        unsubscribe = onAuthStateChange(async (nextSession) => {
          if (!mounted) return;
          if (nextSession && nextSession.user.is_anonymous) {
            await signOutService().catch(() => {});
            if (mounted) clearToSignedOut();
            return;
          }
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

  const signUp = useCallback(async (email: string, password: string, role: UserRole) => {
    const result = await signUpAccount(email, password, role);
    if (result.status === 'active') {
      setAuthUser(result.user);
      setSession(result.session);
      setProfile(result.profile);
      setAuthError(null);
    }
    // The session object also arrives via onAuthStateChange; setting it
    // directly keeps state consistent even if the event races this update.
    // Confirmation-required signups deliberately set nothing: there is no
    // session yet, and inventing one would bypass email verification.
    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithPassword(email, password);
    setAuthUser(result.user);
    setSession(result.session);
    setProfile(result.profile);
    setAuthError(null);
  }, []);

  const claimMissingProfile = useCallback(async (role: UserRole) => {
    const nextProfile = await claimMissingProfileService(role);
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

  const updateProfile = useCallback((next: Profile) => {
    setProfile(next);
    setAuthError(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = authUser ? toAppUser(authUser, profile) : null;
    return {
      session,
      user,
      profile,
      role: user?.role ?? null,
      isVerifiedHelper: profile?.isVerifiedHelper ?? false,
      isLoading,
      // Pure env check (no client creation) so render/SSR stays side-effect free.
      isSupabaseEnabled: isSupabaseConfigured(),
      devAuthEnabled: DEV_AUTH_ENABLED,
      authError,
      signUp,
      signIn,
      claimMissingProfile,
      signOut,
      refreshProfile,
      updateProfile,
    };
  }, [session, authUser, profile, isLoading, authError, signUp, signIn, claimMissingProfile, signOut, refreshProfile, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
