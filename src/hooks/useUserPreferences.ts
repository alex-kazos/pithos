import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export type ThemePreference = 'dark' | 'light' | 'system';
export type AICadence = 'realtime' | 'daily' | 'weekly';

export interface UserPreferences {
  theme: ThemePreference;
  language: string;
  notifyStockAlerts: boolean;
  notifyPush: boolean;
  notifyProductUpdates: boolean;
  notifyMarketing: boolean;
  twoFactorEnabled: boolean;
  aiCadence: AICadence;
  aiWeeklyEmail: boolean;
  reorderPointWeeks: number;
  overstockCeilingWeeks: number;
  hideZeroSales: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  language: 'en',
  notifyStockAlerts: true,
  notifyPush: true,
  notifyProductUpdates: false,
  notifyMarketing: false,
  twoFactorEnabled: false,
  aiCadence: 'daily',
  aiWeeklyEmail: true,
  reorderPointWeeks: 6,
  overstockCeilingWeeks: 12,
  hideZeroSales: false,
};

interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  loading: boolean;
  setPreferences: (patch: Partial<UserPreferences>) => void;
}

export function useUserPreferences(): UseUserPreferencesReturn {
  const { user } = useAuth();
  const [preferences, setPreferencesState] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setPreferencesState(DEFAULT_PREFERENCES);
      setLoading(false);
      return;
    }
    setLoading(true);
    const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
    getDoc(docRef)
      .then(snapshot => {
        if (cancelled) return;
        const data = snapshot.exists() ? (snapshot.data() as Partial<UserPreferences>) : undefined;
        setPreferencesState({ ...DEFAULT_PREFERENCES, ...data });
      })
      .catch(() => { if (!cancelled) setPreferencesState(DEFAULT_PREFERENCES); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid]);

  const setPreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferencesState(prev => ({ ...prev, ...patch }));
    if (!user?.uid) return;
    const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
    setDoc(docRef, { ...patch, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
  }, [user?.uid]);

  return { preferences, loading, setPreferences };
}
