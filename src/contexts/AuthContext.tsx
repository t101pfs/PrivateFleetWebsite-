import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CognitoUserSession } from 'amazon-cognito-identity-js';
import {
  getCurrentSession,
  signInWithPassword,
  signOut as cognitoSignOut,
  forgotPassword,
} from '@/integrations/aws/cognito';
import { User } from '@/types/charter';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Compatibility shim: many not-yet-migrated hooks/components (still calling
// Supabase directly — Phase 3+ work) read `supabaseUser.id` as "the current
// user's id" the same way `user.id` is used. Both now hold the same Cognito
// `sub` value, so this keeps those call sites compiling untouched until
// they're migrated off Supabase in a later phase.
interface CompatSupabaseUser {
  id: string;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: CompatSupabaseUser | null;
  mustChangePassword: boolean;
  loginWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface MeResponse {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  avatar: string | null;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<CompatSupabaseUser | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetches the merged profile+role object from the API (replaces the two
  // Supabase table queries the old fetchUserProfile made directly).
  const fetchMe = async (session: CognitoUserSession) => {
    const cognitoSub = session.getIdToken().payload.sub as string;
    setSupabaseUser({ id: cognitoSub });

    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: { Authorization: session.getIdToken().getJwtToken() },
      });

      if (!response.ok) {
        throw new Error(`GET /me failed: ${response.status}`);
      }

      const data: MeResponse = await response.json();

      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        avatar: data.avatar ?? undefined,
      });
      setMustChangePassword(data.mustChangePassword);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      const email = session.getIdToken().payload.email as string | undefined;
      setUser({
        id: session.getIdToken().payload.sub,
        name: email?.split('@')[0] ?? 'Unknown',
        email: email ?? '',
        role: 'sales',
      });
    }
  };

  const refreshSession = async () => {
    try {
      const session = await getCurrentSession();
      if (session?.isValid()) {
        setIsAuthenticated(true);
        await fetchMe(session);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setSupabaseUser(null);
        setMustChangePassword(false);
      }
    } catch (err) {
      console.error('Error refreshing session:', err);
      setIsAuthenticated(false);
      setUser(null);
      setSupabaseUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
    // Cognito's JS SDK has no equivalent to Supabase's onAuthStateChange
    // push-based listener — session state is re-checked on mount and
    // explicitly after login/logout instead.
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const session = await signInWithPassword(email, password);
      setIsAuthenticated(true);
      await fetchMe(session);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await forgotPassword(email);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const logout = async () => {
    cognitoSignOut();
    setUser(null);
    setSupabaseUser(null);
    setIsAuthenticated(false);
    setMustChangePassword(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      mustChangePassword,
      loginWithEmail,
      resetPassword,
      logout,
      isAuthenticated,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
