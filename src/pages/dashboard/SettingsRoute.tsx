import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences, UserPreferences, ThemePreference, AICadence } from '../../hooks/useUserPreferences';
import { useDashboardPreset } from '../../hooks/useDashboardPreset';
import { VISIBLE_DASHBOARD_PRESETS, DASHBOARD_WIDGET_CATALOG } from '../../constants/dashboardWidgets';
import { ManageStoresModal } from '../../components/dashboard/ManageStoresModal';
import { getStoreDisplayName } from '../../utils/storeDisplay';
import { cacheService } from '../../services/cacheService';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardShell';

type SectionId = 'profile' | 'security' | 'notifications' | 'appearance' | 'stores' | 'dashboard' | 'thresholds' | 'ai' | 'danger';

const NAV_GROUPS: { group: string; items: { id: SectionId; label: string }[] }[] = [
  {
    group: 'ACCOUNT',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'security', label: 'Sign-in & security' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'appearance', label: 'Appearance & language' },
    ],
  },
  {
    group: 'STORE',
    items: [
      { id: 'stores', label: 'Stores' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'thresholds', label: 'Thresholds' },
      { id: 'ai', label: 'AI usage' },
    ],
  },
  { group: 'DANGER', items: [{ id: 'danger', label: 'Delete account' }] },
];

const SECTION_COPY: Record<SectionId, [string, string]> = {
  profile: ['Profile', 'Your name and the email StockPilot writes to.'],
  security: ['Sign-in & security', 'How you get into the account, and the extra lock on it.'],
  notifications: ['Notifications', 'What StockPilot is allowed to send you, and where.'],
  appearance: ['Appearance & language', 'Dark by default, light for daytime floor screens.'],
  stores: ['Stores', 'Manage the stores connected to this account.'],
  dashboard: ['Dashboard layout', "Pick the preset that matches how this store is run. It applies to Overview for everyone on the account."],
  thresholds: ['Thresholds', 'What counts as urgent, everywhere in the app.'],
  ai: ['AI usage', 'Chat messages against your monthly quota.'],
  danger: ['Delete account', 'This cannot be undone.'],
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative flex-none w-10 h-[23px] rounded-full border border-white/[0.12] ${checked ? 'bg-accent' : 'bg-white/10'}`}
    >
      <span
        className={`absolute top-[2px] left-[3px] w-[17px] h-[17px] rounded-full bg-[#e9e9f0] block transition-transform ${checked ? 'translate-x-[17px]' : ''}`}
      />
    </button>
  );
}

function SettingsRow({
  title,
  description,
  control,
  border = true,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3.5 ${border ? 'border-b border-white/[0.06]' : ''}`}>
      <div className="min-w-0">
        <div className="font-archivo font-medium text-[13px] text-white">{title}</div>
        <div className="mt-[3px] font-archivo text-[11.5px] text-white/40">{description}</div>
      </div>
      {control}
    </div>
  );
}

function DashboardPresetSection({ storeKey }: { storeKey: string }) {
  const { presetId, setPresetId } = useDashboardPreset(storeKey);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 max-w-[860px]">
        {VISIBLE_DASHBOARD_PRESETS.map(p => {
          const active = p.id === presetId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              className={`text-left flex flex-col gap-3 p-4 rounded-[13px] border ${
                active ? 'bg-accent/[0.08] border-accent/50' : 'bg-surface border-white/[0.08] hover:border-accent/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="font-archivo font-semibold text-sm text-white">{p.name}</div>
                  <div className="mt-1 font-archivo text-[11.5px] leading-snug text-white/50">{p.blurb}</div>
                </div>
                <span
                  className={`flex-none px-[9px] py-1 rounded-full font-mono-ibm font-semibold text-[9.5px] tracking-wide ${
                    active ? 'bg-accent text-canvas' : 'border border-white/[0.14] text-white/55'
                  }`}
                >
                  {active ? 'IN USE' : 'Use this'}
                </span>
              </div>
              <div className="flex flex-wrap gap-[5px] p-[11px] rounded-[9px] bg-canvas-2/50">
                {p.layout.map((w, i) => {
                  const kind = DASHBOARD_WIDGET_CATALOG[w.id]?.kind;
                  const width = w.span === 3 ? '100%' : w.span === 2 ? 'calc(66.66% - 3px)' : 'calc(33.33% - 4px)';
                  const height = kind === 'kpi' ? 11 : 26;
                  return (
                    <span
                      key={`${w.id}-${i}`}
                      className={`block rounded-[3px] ${active ? 'bg-accent/55' : 'bg-white/[0.13]'}`}
                      style={{ width, height }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between font-archivo text-[11px] text-white/40">
                <span>{p.who}</span>
                <span className="font-mono-ibm">{p.layout.length} cards</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="font-archivo text-[11.5px] leading-relaxed text-white/35 max-w-[560px]">
        The preset applies to everyone with access to this store, so a card sits in the same place for all of you.
      </p>
    </div>
  );
}

interface StoreRow {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

function StoresSection({ onCountChange }: { onCountChange: (count: number) => void }) {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManage, setShowManage] = useState(false);

  const loadStores = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'stores'));
      const rows: StoreRow[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: getStoreDisplayName(data.shopUrl || data.storeUrl || d.id),
          type: data.platform || 'shopify',
          isActive: !!data.isActive,
        };
      });
      setStores(rows);
      onCountChange(rows.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="max-w-[620px] flex flex-col gap-2.5">
      {loading ? (
        <p className="font-archivo text-[12.5px] text-white/45">Loading…</p>
      ) : (
        stores.map(store => (
          <div key={store.id} className="flex items-center justify-between gap-3 p-4 rounded-[11px] bg-surface border border-white/[0.07]">
            <div>
              <div className="font-archivo font-semibold text-[13.5px] text-white">{store.name}</div>
              <div className="mt-1 font-mono-ibm text-[11px] text-white/40 capitalize">{store.type}</div>
            </div>
            {store.isActive && (
              <span className="font-mono-ibm font-semibold text-[10px] px-2 py-[3px] rounded-full bg-band-green/[0.14] text-[#7fd4a8]">
                ACTIVE
              </span>
            )}
          </div>
        ))
      )}
      <button
        type="button"
        onClick={() => setShowManage(true)}
        className="py-3.5 px-4 rounded-[11px] border border-dashed border-white/[0.16] text-white/60 hover:text-white hover:border-accent/50 font-archivo font-medium text-[12.5px] text-left"
      >
        + Connect or manage stores
      </button>
      {showManage && (
        <ManageStoresModal
          onClose={() => {
            setShowManage(false);
            loadStores();
          }}
        />
      )}
    </div>
  );
}

function NumberStepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5 flex-none">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-6 h-6 rounded-md border border-white/[0.12] text-white/60 hover:text-white font-archivo text-sm leading-none"
      >
        −
      </button>
      <div className="flex items-center gap-1.5 px-[11px] py-[7px] rounded-lg bg-white/[0.04] border border-white/[0.09] min-w-[58px] justify-center">
        <span className="font-mono-ibm font-semibold text-[13px] text-white">{value}</span>
        <span className="font-archivo text-[11px] text-white/45">wk</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-6 h-6 rounded-md border border-white/[0.12] text-white/60 hover:text-white font-archivo text-sm leading-none"
      >
        +
      </button>
    </div>
  );
}

function ThresholdsSection({
  preferences,
  setPreferences,
}: {
  preferences: UserPreferences;
  setPreferences: (patch: Partial<UserPreferences>) => void;
}) {
  return (
    <div className="max-w-[620px] flex flex-col">
      <SettingsRow
        title="Reorder point"
        description="Flag a SKU below this many weeks of cover"
        control={
          <NumberStepper
            value={preferences.reorderPointWeeks}
            min={1}
            max={preferences.overstockCeilingWeeks - 1}
            onChange={v => setPreferences({ reorderPointWeeks: v })}
          />
        }
      />
      <SettingsRow
        title="Overstock ceiling"
        description="Above this, capital counts as idle"
        control={
          <NumberStepper
            value={preferences.overstockCeilingWeeks}
            min={preferences.reorderPointWeeks + 1}
            max={52}
            onChange={v => setPreferences({ overstockCeilingWeeks: v })}
          />
        }
      />
      <SettingsRow
        border={false}
        title="Hide zero-sales SKUs"
        description="Excludes SKUs with no sales this window from Overview's lists and table"
        control={<Toggle checked={preferences.hideZeroSales} onChange={v => setPreferences({ hideZeroSales: v })} />}
      />
    </div>
  );
}

interface ChatUsage {
  used: number;
  limit: number;
  resetsAt: string;
}

function AIUsageSection({
  preferences,
  setPreferences,
}: {
  preferences: UserPreferences;
  setPreferences: (patch: Partial<UserPreferences>) => void;
}) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/openai/usage', { headers: { authorization: `Bearer ${idToken}` } });
        if (!response.ok) throw new Error('Failed to load AI usage');
        const data = await response.json();
        if (!cancelled) setUsage(data.usage);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load AI usage');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const resetsInDays = usage
    ? Math.max(0, Math.ceil((new Date(usage.resetsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="max-w-[620px] flex flex-col gap-[18px]">
      <div className="p-4 rounded-xl bg-surface border border-white/[0.07]">
        {loading ? (
          <p className="font-archivo text-[12.5px] text-white/45">Loading…</p>
        ) : error ? (
          <p className="font-archivo text-[12.5px] text-band-red">{error}</p>
        ) : usage ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-archivo font-semibold text-[13px] text-white">Chat messages</span>
              <span className="font-mono-ibm font-semibold text-xs text-white/60">
                {usage.used} / {usage.limit}
              </span>
            </div>
            <div className="mt-[11px] h-2 rounded-full bg-white/[0.06]">
              <div
                className={`h-2 rounded-full ${usage.used >= usage.limit ? 'bg-band-red' : 'bg-accent'}`}
                style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
              />
            </div>
            {resetsInDays !== null && <p className="mt-3 font-archivo text-[11.5px] text-white/40">Resets in {resetsInDays}d</p>}
          </>
        ) : null}
      </div>
      <div className="flex flex-col">
        <SettingsRow
          title="Refresh cadence"
          description="How often the queue regenerates on its own"
          control={
            <div className="flex bg-white/[0.04] border border-white/[0.09] rounded-lg p-[2px] flex-none">
              {(['realtime', 'daily', 'weekly'] as AICadence[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPreferences({ aiCadence: c })}
                  className={`px-[11px] py-1.5 rounded-md font-archivo font-semibold text-[11.5px] capitalize ${
                    preferences.aiCadence === c ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          }
        />
        <SettingsRow
          border={false}
          title="Email me the queue each Monday"
          description="One message, the open decisions only"
          control={<Toggle checked={preferences.aiWeeklyEmail} onChange={v => setPreferences({ aiWeeklyEmail: v })} />}
        />
      </div>
    </div>
  );
}

const THEMES: { id: ThemePreference; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: '#15141e' },
  { id: 'light', label: 'Light', swatch: '#e9e9f0' },
  { id: 'system', label: 'System', swatch: 'linear-gradient(135deg,#15141e 50%,#e9e9f0 50%)' },
];

const LANGS: { id: string; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'el', label: 'Ελληνικά' },
];

function AppearanceSection({
  preferences,
  setPreferences,
}: {
  preferences: UserPreferences;
  setPreferences: (patch: Partial<UserPreferences>) => void;
}) {
  return (
    <div className="max-w-[560px] flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2.5">
        {THEMES.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPreferences({ theme: t.id })}
            className={`p-[11px] rounded-[11px] border text-left ${
              preferences.theme === t.id ? 'border-accent/60' : 'border-white/[0.09] hover:border-accent/40'
            }`}
          >
            <span className="block h-11 rounded-[7px] border border-white/[0.08]" style={{ background: t.swatch }} />
            <span className="block mt-2.5 font-archivo font-semibold text-xs text-white">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/[0.06]">
        <div>
          <div className="font-archivo font-medium text-[13px] text-white">Language</div>
          <div className="mt-[3px] font-archivo text-[11.5px] text-white/40">Interface language for everyone on this account</div>
        </div>
        <div className="flex gap-[7px] flex-none">
          {LANGS.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => setPreferences({ language: l.id })}
              className={`px-[13px] py-[7px] rounded-lg border font-archivo font-semibold text-xs ${
                preferences.language === l.id ? 'border-accent bg-accent/10 text-accent-soft' : 'border-white/[0.12] text-white/65 hover:text-white'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user, updateProfile, updateEmail } = useAuth();
  const [fullName, setFullName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dirty = fullName !== (user?.displayName || '') || email !== (user?.email || '');

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const nameChanged = fullName !== (user?.displayName || '');
      const emailChanged = email !== (user?.email || '');
      if (nameChanged) await updateProfile(fullName);
      if (emailChanged) await updateEmail(email);
      setMessage({ type: 'success', text: emailChanged ? 'Saved. Check your new inbox to confirm the email change.' : 'Saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setFullName(user?.displayName || '');
    setEmail(user?.email || '');
    setMessage(null);
  };

  return (
    <div className="max-w-[520px] flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="font-archivo font-medium text-[11.5px] text-white/60">Full name</span>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          className="px-3.5 py-2.5 rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-white text-[13px] font-archivo outline-none focus:border-accent/60"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-archivo font-medium text-[11.5px] text-white/60">Email address</span>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="px-3.5 py-2.5 rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-white text-[13px] font-archivo outline-none focus:border-accent/60"
        />
        <span className="font-archivo text-[11px] text-white/35">Changing this sends a confirmation link to the new address</span>
      </label>
      {message && (
        <p className={`font-archivo text-[12px] ${message.type === 'success' ? 'text-band-green' : 'text-band-red'}`}>{message.text}</p>
      )}
      <div className="flex gap-2 mt-0.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-[15px] py-2.5 rounded-[9px] bg-accent hover:bg-accent-hover text-canvas font-archivo font-semibold text-[12.5px] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={!dirty || saving}
          className="px-[15px] py-2.5 rounded-[9px] border border-white/[0.12] text-white/65 hover:text-white font-archivo font-medium text-[12.5px] disabled:opacity-40"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function SecuritySection({
  preferences,
  setPreferences,
}: {
  preferences: UserPreferences;
  setPreferences: (patch: Partial<UserPreferences>) => void;
}) {
  const { user, signOut, sendPasswordReset } = useAuth();
  const isGoogle = user?.providerData?.[0]?.providerId === 'google.com';
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const handleResetPassword = async () => {
    setResetting(true);
    setResetMsg(null);
    try {
      await sendPasswordReset();
      setResetMsg('Password reset email sent.');
    } catch (err) {
      setResetMsg(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-[620px] flex flex-col">
      <SettingsRow
        title={user?.email || ''}
        description={isGoogle ? 'Signed in with Google' : 'Signed in with email & password'}
        control={
          <button
            type="button"
            onClick={() => signOut()}
            className="flex-none px-[11px] py-[7px] rounded-lg border border-white/[0.12] text-white/65 hover:text-white font-archivo font-medium text-[11.5px]"
          >
            Sign out
          </button>
        }
      />
      <SettingsRow
        title="Two-factor authentication"
        description="Add an extra layer of security to your account"
        control={<Toggle checked={preferences.twoFactorEnabled} onChange={v => setPreferences({ twoFactorEnabled: v })} />}
      />
      <SettingsRow
        border={false}
        title="Password"
        description="Set one to sign in without Google"
        control={
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetting}
            className="flex-none px-[11px] py-[7px] rounded-lg border border-white/[0.12] text-white/65 hover:text-white font-archivo font-medium text-[11.5px] disabled:opacity-50"
          >
            {resetting ? 'Sending…' : 'Change password'}
          </button>
        }
      />
      {resetMsg && <p className="mt-2 font-archivo text-[12px] text-white/60">{resetMsg}</p>}
    </div>
  );
}

function NotificationsSection({
  preferences,
  setPreferences,
}: {
  preferences: UserPreferences;
  setPreferences: (patch: Partial<UserPreferences>) => void;
}) {
  return (
    <div className="max-w-[620px] flex flex-col">
      <SettingsRow
        title="Stock alerts by email"
        description="Stockouts and dead stock, as they are detected"
        control={<Toggle checked={preferences.notifyStockAlerts} onChange={v => setPreferences({ notifyStockAlerts: v })} />}
      />
      <SettingsRow
        title="Push notifications"
        description="Browser alerts while StockPilot is open"
        control={<Toggle checked={preferences.notifyPush} onChange={v => setPreferences({ notifyPush: v })} />}
      />
      <SettingsRow
        title="Product updates"
        description="New features and changes to the forecast model"
        control={<Toggle checked={preferences.notifyProductUpdates} onChange={v => setPreferences({ notifyProductUpdates: v })} />}
      />
      <SettingsRow
        border={false}
        title="Marketing"
        description="Occasional email about StockPilot itself"
        control={<Toggle checked={preferences.notifyMarketing} onChange={v => setPreferences({ notifyMarketing: v })} />}
      />
    </div>
  );
}

const CONFIRM_PHRASE = 'DELETE';

function DangerSection({ refetch }: { refetch: () => Promise<void> }) {
  const { user, signOut } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [clearedMsg, setClearedMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClearCache = async () => {
    if (!user) return;
    setClearing(true);
    setClearedMsg(null);
    try {
      cacheService.clearCache(user.uid);
      await refetch();
      setClearedMsg('Cache cleared — data refreshed.');
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async () => {
    if (!user || confirmText !== CONFIRM_PHRASE) return;
    setDeleting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/account/delete-data', {
        method: 'POST',
        headers: { authorization: `Bearer ${idToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to delete account data');
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account data');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-[620px] flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-white/[0.07]">
        <div>
          <div className="font-archivo font-medium text-[13px] text-white">Clear cached store data</div>
          <div className="mt-[3px] font-archivo text-[11.5px] text-white/40">
            Forces a full re-sync of products and orders. Recommendations regenerate.
          </div>
          {clearedMsg && <p className="mt-1.5 font-archivo text-[11.5px] text-band-green">{clearedMsg}</p>}
        </div>
        <button
          type="button"
          onClick={handleClearCache}
          disabled={clearing}
          className="flex-none px-3 py-2 rounded-lg border border-white/[0.12] text-white/65 hover:text-white font-archivo font-medium text-xs disabled:opacity-50"
        >
          {clearing ? 'Clearing…' : 'Clear'}
        </button>
      </div>

      <div className="p-4 rounded-xl bg-band-red/[0.05] border border-band-red/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-archivo font-semibold text-[13px] text-[#ff9d93]">Delete account</div>
            <div className="mt-1 font-archivo text-[11.5px] leading-snug text-white/50">
              Removes your stores, cached data and recommendations. This cannot be undone.
            </div>
          </div>
          {!confirmOpen && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex-none px-[13px] py-2 rounded-lg border border-band-red/40 text-[#ff9d93] hover:bg-band-red/[0.12] font-archivo font-semibold text-xs"
            >
              Delete
            </button>
          )}
        </div>

        {confirmOpen && (
          <div className="mt-3.5 flex flex-col gap-2.5">
            {error && <p className="font-archivo text-[12px] text-band-red">{error}</p>}
            <label className="font-archivo text-[11.5px] text-white/50">
              Type <span className="font-mono-ibm text-white">{CONFIRM_PHRASE}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              disabled={deleting}
              className="px-3 py-2 rounded-lg border border-white/[0.14] bg-canvas-2 text-white font-archivo text-[13px] outline-none focus:border-band-red/60"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== CONFIRM_PHRASE || deleting}
                className="px-[13px] py-2 rounded-lg bg-band-red text-canvas font-archivo font-semibold text-xs disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText('');
                  setError(null);
                }}
                disabled={deleting}
                className="px-[13px] py-2 rounded-lg text-white/50 hover:text-white font-archivo font-medium text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsRoute() {
  const { storeKey, refetch } = useOutletContext<DashboardOutletContext>();
  const { preferences, setPreferences } = useUserPreferences();
  const [section, setSection] = useState<SectionId>('dashboard');
  const [storeCount, setStoreCount] = useState<number | null>(null);

  const [title, sub] = SECTION_COPY[section];

  return (
    <div className="flex flex-col gap-4">
      <div className="pb-4 border-b border-white/[0.06]">
        <h1 className="font-archivo font-semibold text-[19px] tracking-tight text-white">Settings</h1>
        <p className="mt-[3px] font-archivo text-xs text-white/45">Changes save as you make them</p>
      </div>

      <div className="flex gap-6 items-start">
        <nav className="w-[204px] flex-none flex flex-col gap-4">
          {NAV_GROUPS.map(g => (
            <div key={g.group} className="flex flex-col gap-0.5">
              <span className="px-[11px] pb-1.5 font-mono-ibm text-[9.5px] tracking-widest text-white/30">{g.group}</span>
              {g.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex items-center justify-between gap-2 px-[11px] py-[9px] rounded-lg font-archivo text-left ${
                    section === item.id
                      ? 'bg-accent/[0.14] text-accent-soft font-semibold text-[12.5px]'
                      : 'text-white/62 font-medium text-[12.5px] hover:bg-white/[0.05]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.id === 'stores' && storeCount !== null && (
                    <span className="font-mono-ibm text-[10px] text-white/32">{storeCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex-1 min-w-0 flex flex-col gap-[18px]">
          <div className="max-w-[620px]">
            <h2 className="font-archivo font-semibold text-[17px] tracking-tight text-white">{title}</h2>
            <p className="mt-1.5 font-archivo text-[12.5px] leading-relaxed text-white/48">{sub}</p>
          </div>

          {section === 'dashboard' && <DashboardPresetSection storeKey={storeKey} />}
          {section === 'stores' && <StoresSection onCountChange={setStoreCount} />}
          {section === 'thresholds' && <ThresholdsSection preferences={preferences} setPreferences={setPreferences} />}
          {section === 'ai' && <AIUsageSection preferences={preferences} setPreferences={setPreferences} />}
          {section === 'appearance' && <AppearanceSection preferences={preferences} setPreferences={setPreferences} />}
          {section === 'profile' && <ProfileSection />}
          {section === 'security' && <SecuritySection preferences={preferences} setPreferences={setPreferences} />}
          {section === 'notifications' && <NotificationsSection preferences={preferences} setPreferences={setPreferences} />}
          {section === 'danger' && <DangerSection refetch={refetch} />}
        </div>
      </div>
    </div>
  );
}
