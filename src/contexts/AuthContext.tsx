import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  verifyBeforeUpdateEmail,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  sendPasswordReset: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      navigate('/dashboard');
    } catch (error) {
      console.error('Sign in error:', error);
      if (error instanceof Error) {
        if (error.message.includes('auth/invalid-credential')) {
          throw new Error('Invalid email or password');
        } else if (error.message.includes('auth/too-many-requests')) {
          throw new Error('Too many failed attempts. Please try again later');
        } else {
          throw error;
        }
      }
      throw new Error('Failed to sign in');
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await firebaseUpdateProfile(result.user, { displayName });
      }
      setUser(result.user);
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('auth/email-already-in-use')) {
          throw new Error('Email is already registered');
        } else if (error.message.includes('auth/weak-password')) {
          throw new Error('Password should be at least 6 characters');
        } else {
          throw error;
        }
      }
      throw new Error('Failed to sign up');
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      // Handle specific error cases
      switch (error.code) {
        case 'auth/popup-blocked':
          throw new Error('Please allow popups for this site to sign in with Google');
        case 'auth/popup-closed-by-user':
          throw new Error('Sign-in cancelled');
        case 'auth/unauthorized-domain':
          throw new Error('This domain is not authorized for Google sign-in');
        case 'auth/internal-error':
          throw new Error('Unable to connect to Google. Please try again later.');
        case 'auth/user-disabled':
          throw new Error('This account has been disabled. Please contact support for assistance.');
        default:
          throw new Error('Failed to sign in with Google');
      }
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      navigate('/');
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to sign out');
    }
  };

  const updateProfile = async (displayName: string) => {
    if (!auth.currentUser) throw new Error('You must be signed in');
    await firebaseUpdateProfile(auth.currentUser, { displayName });
    setUser({ ...auth.currentUser });
  };

  // Firebase requires a fresh sign-in for this and sends a confirmation link
  // to the NEW address rather than swapping it immediately - the account's
  // email doesn't actually change until that link is clicked.
  const updateEmail = async (newEmail: string) => {
    if (!auth.currentUser) throw new Error('You must be signed in');
    try {
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
    } catch (error: any) {
      if (error?.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and back in, then try again');
      }
      throw error instanceof Error ? error : new Error('Failed to update email');
    }
  };

  const sendPasswordReset = async () => {
    if (!auth.currentUser?.email) throw new Error('No email on this account');
    await sendPasswordResetEmail(auth, auth.currentUser.email);
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updateProfile,
    updateEmail,
    sendPasswordReset
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#13111C] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
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