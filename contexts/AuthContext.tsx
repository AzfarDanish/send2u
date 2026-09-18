import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const profileRequest = useRef(0);
  const sessionUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      const request = ++profileRequest.current;
      const nextUser = nextSession?.user ?? null;
      const changedUser = sessionUserId.current !== nextUser?.id;
      sessionUserId.current = nextUser?.id ?? null;
      if (pending) clearTimeout(pending);
      if (!nextUser || nextUser.is_anonymous) {
        setSession(null);
        setAuthUser(null);
        setProfile(null);
        setAuthError(null);
        setIsLoading(false);
        if (nextUser?.is_anonymous) {
          pending = setTimeout(() => {
            if (mounted && request === profileRequest.current) {
              void signOutService().catch(() => {});
            }
          }, 0);
        }
        return;
      }
      if (changedUser) {
        setIsLoading(true);
        setProfile(null);
        setAuthError(null);
      }
      setSession(nextSession);
      setAuthUser(nextUser);
      pending = setTimeout(() => {
        if (!mounted || request !== profileRequest.current) return;
        void (async () => {
          try {
            const nextProfile = await fetchProfile(nextUser.id);
            if (mounted && request === profileRequest.current) {
              setProfile(nextProfile);
              setAuthError(null);
            }
          } catch (error) {
            if (mounted && request === profileRequest.current) {
              setAuthError(error instanceof Error ? error.message : 'Could not load profile.');
            }
          } finally {
            if (mounted && request === profileRequest.current) setIsLoading(false);
          }
        })();
      }, 0);
    };
    void (async () => {
      const restoreRequest = profileRequest.current;
      try {
        if (!getSupabaseClient()) {
          if (mounted) setIsLoading(false);
          return;
        }
        unsubscribe = onAuthStateChange(applySession);
        const active = await getActiveSession();
        if (mounted && restoreRequest === profileRequest.current) {
          applySession(active?.session ?? null);
        }
      } catch (error) {
        if (mounted && restoreRequest === profileRequest.current) {
          setAuthError(error instanceof Error ? error.message : 'Could not restore session.');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
      profileRequest.current += 1;
      sessionUserId.current = null;
      if (pending) clearTimeout(pending);
      unsubscribe?.();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, role: UserRole) => {
    const result = await signUpAccount(email, password, role);
    if (result.status === 'active' && sessionUserId.current === result.user.id) {
      profileRequest.current += 1;
      setProfile(result.profile);
      setAuthError(null);
      setIsLoading(false);
    }
    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithPassword(email, password);
    if (sessionUserId.current === result.user.id) {
      profileRequest.current += 1;
      setProfile(result.profile);
      setAuthError(null);
      setIsLoading(false);
    }
  }, []);

  const claimMissingProfile = useCallback(async (role: UserRole) => {
    const nextProfile = await claimMissingProfileService(role);
    if (sessionUserId.current !== nextProfile.id) return;
    profileRequest.current += 1;
    setProfile(nextProfile);
    setAuthError(null);
    setIsLoading(false);
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
    const request = ++profileRequest.current;
    try {
      const nextProfile = await fetchProfile(authUser.id);
      if (request !== profileRequest.current) return;
      setProfile(nextProfile);
      setAuthError(null);
    } catch (error) {
      if (request === profileRequest.current) {
        setAuthError(error instanceof Error ? error.message : 'Could not load profile.');
      }
      throw error;
    } finally {
      if (request === profileRequest.current) setIsLoading(false);
    }
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
