import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User, UserRole } from '@/types/charter';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  mustChangePassword: boolean;
  effectiveRole: UserRole;
  login: (role: UserRole) => void;
  loginWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Re-reads the current user's profile (name, avatar) from the database —
   * call after saving a change to it so the app reflects it immediately
   * instead of waiting for the next login/page load. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Every role sees exactly its own pages - Sales sees Sales, Ops sees
  // Ops, Admin/Super Admin see everything. No role-preview/masquerade
  // mode anymore (previously let a Super Admin "view as" Sales/Ops).
  const effectiveRole: UserRole = user?.role ?? 'sales';

  // Fetch user profile and role from database
  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      // Fetch role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      // Fetch profile including must_change_password flag
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, must_change_password, job_title, job_title_ar')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      const role = (roleData?.role as UserRole) || 'sales';
      const fullName = profileData?.full_name || email.split('@')[0];
      
      // Set must change password flag
      setMustChangePassword(profileData?.must_change_password || false);

      const appUser: User = {
        id: userId,
        name: fullName,
        email: email,
        role: role,
        avatar: profileData?.avatar_url || undefined,
        jobTitle: profileData?.job_title || undefined,
        jobTitleAr: profileData?.job_title_ar || undefined,
      };

      setUser(appUser);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Fallback to basic user
      setUser({
        id: userId,
        name: email.split('@')[0],
        email: email,
        role: 'sales',
      });
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setSupabaseUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid deadlock with Supabase calls
          setTimeout(() => {
            fetchUserProfile(session.user.id, session.user.email || '');
          }, 0);
        } else {
          setUser(null);
          setMustChangePassword(false);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email || '');
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Demo login (for role selection - kept for backwards compatibility)
  const login = (role: UserRole) => {
    setUser({
      id: 'demo-user',
      name: role.charAt(0).toUpperCase() + role.slice(1) + ' User',
      email: `${role}@demo.com`,
      role: role,
    });
  };

  const loginWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    return { error: error as Error | null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
    setMustChangePassword(false);
  };

  const refreshProfile = async () => {
    if (!supabaseUser) return;
    await fetchUserProfile(supabaseUser.id, supabaseUser.email || '');
  };

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      session,
      mustChangePassword,
      effectiveRole,
      login,
      loginWithEmail,
      resetPassword,
      logout,
      isAuthenticated: !!session,
      isLoading,
      refreshProfile
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
