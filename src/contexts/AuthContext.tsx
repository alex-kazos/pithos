import React, { createContext, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../lib/authClient';

/** The signed-in user, as the rest of the app sees them. */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Better Auth returns `{ error }` instead of throwing - turn that into a thrown Error. */
function throwIfError(result: { error?: { message?: string; status?: number } | null }, fallback: string): void {
  if (result.error) throw new Error(result.error.message || fallback);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, refetch } = authClient.useSession();
  const navigate = useNavigate();

  const user = useMemo<AppUser | null>(
    () =>
      session?.user
        ? { uid: session.user.id, email: session.user.email ?? null, displayName: session.user.name || null }
        : null,
    [session?.user]
  );

  const value: AuthContextType = {
    user,
    loading: isPending,

    signIn: async (email, password) => {
      const result = await authClient.signIn.email({ email, password });
      if (result.error?.status === 401) throw new Error('Invalid email or password');
      throwIfError(result, 'Failed to sign in');
      navigate('/dashboard');
    },

    signUp: async (email, password, displayName) => {
      // Better Auth requires a name; fall back to the email's local part.
      const name = displayName?.trim() || email.split('@')[0];
      throwIfError(await authClient.signUp.email({ email, password, name }), 'Failed to sign up');
      navigate('/dashboard');
    },

    // Full-page redirect to Google and back to /dashboard.
    signInWithGoogle: async () => {
      throwIfError(
        await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' }),
        'Failed to sign in with Google'
      );
    },

    signOut: async () => {
      throwIfError(await authClient.signOut(), 'Failed to sign out');
      navigate('/');
    },

    updateProfile: async displayName => {
      throwIfError(await authClient.updateUser({ name: displayName }), 'Failed to update your name');
      await refetch();
    },

    updateEmail: async newEmail => {
      throwIfError(await authClient.changeEmail({ newEmail }), 'Failed to update email');
      await refetch();
    },

    changePassword: async (currentPassword, newPassword) => {
      throwIfError(
        await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true }),
        'Failed to change password'
      );
    },
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#13111C] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
