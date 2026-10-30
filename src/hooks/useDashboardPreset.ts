import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toLayoutDocId } from '../utils/storeDisplay';
import { DEFAULT_PRESET_ID } from '../constants/dashboardWidgets';
import { getLayoutPreset, setLayoutPreset } from '../services/api';

interface UseDashboardPresetReturn {
  presetId: string;
  loading: boolean;
  setPresetId: (id: string) => void;
}

/**
 * Persists which Overview layout preset is active per store-view (a real
 * store id, or the sanitized "all stores" sentinel from toLayoutDocId).
 * Switching presets is a single click with no debounce needed - unlike the
 * old per-widget layout editor this replaces, there's no rapid-fire drag or
 * resize event stream to coalesce.
 */
export function useDashboardPreset(storeId: string): UseDashboardPresetReturn {
  const { user } = useAuth();
  const [presetId, setPresetIdState] = useState<string>(DEFAULT_PRESET_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid || !storeId) {
      setPresetIdState(DEFAULT_PRESET_ID);
      setLoading(false);
      return;
    }

    setLoading(true);
    getLayoutPreset(toLayoutDocId(storeId))
      .then(preset => {
        if (!cancelled) setPresetIdState(preset || DEFAULT_PRESET_ID);
      })
      .catch(() => {
        if (!cancelled) setPresetIdState(DEFAULT_PRESET_ID);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, storeId]);

  const setPresetId = useCallback((next: string) => {
    setPresetIdState(next);
    if (!user?.uid || !storeId) return;
    setLayoutPreset(toLayoutDocId(storeId), next).catch(() => {
      // Best-effort persistence - a failed write just means the preset resets to
      // last-saved on reload, not a broken UI.
    });
  }, [user?.uid, storeId]);

  return { presetId, loading, setPresetId };
}
