import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { CheckCircle } from 'lucide-react';
import { connectWooCommerceStore, startStoreOAuth } from '../../services/api';

// Mirrors functions/lib/wooCommerceAuth.ts's validation - duplicated client-side
// (same pattern as ShopifySetup.tsx) since backend-only modules aren't bundled
// into the client. The proxy re-validates independently regardless.
const CONSUMER_KEY_PATTERN = /^ck_[a-f0-9]{40}$/i;
const CONSUMER_SECRET_PATTERN = /^cs_[a-f0-9]{40}$/i;

function normalizeStoreUrlInput(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return `${url.protocol}//${url.host}`;
}

function validateWooCommerceInputs(storeUrl: string, consumerKey: string, consumerSecret: string): string | null {
  if (!normalizeStoreUrlInput(storeUrl)) {
    return 'Enter your store\'s full URL, e.g. "https://your-store.com"';
  }
  if (!CONSUMER_KEY_PATTERN.test(consumerKey.trim())) {
    return 'Enter a valid Consumer Key (starts with ck_)';
  }
  if (!CONSUMER_SECRET_PATTERN.test(consumerSecret.trim())) {
    return 'Enter a valid Consumer Secret (starts with cs_)';
  }
  return null;
}

// Deep-links straight to WooCommerce's "create key" screen instead of making
// the merchant hunt through Settings > Advanced > REST API themselves.
function createKeyUrl(storeUrl: string): string | null {
  const normalized = normalizeStoreUrlInput(storeUrl);
  if (!normalized) return null;
  return `${normalized}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys&create-key=1`;
}

interface WooCommerceSetupProps {
  onClose: () => void;
  /** Renders just the card content, no fixed backdrop/close button - used to embed this inline in the onboarding wizard. */
  standalone?: boolean;
  /** Success redirects to /dashboard?onboarding=1 instead of /dashboard, so DashboardPage shows the first-sync screen. */
  isOnboarding?: boolean;
  /** Shown as a link to connect a different platform instead - only passed by the onboarding wizard. */
  onSwitchPlatform?: () => void;
}

export function WooCommerceSetup({ onClose, standalone = false, isOnboarding = false, onSwitchPlatform }: WooCommerceSetupProps) {
  useLockBodyScroll(!standalone);
  const [connectStoreUrl, setConnectStoreUrl] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { user } = useAuth();

  const handleConnectWithWooCommerce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setOauthError('You must be logged in to connect your store');
      return;
    }
    if (!normalizeStoreUrlInput(connectStoreUrl)) {
      setOauthError('Enter your store\'s full URL, e.g. "https://your-store.com"');
      return;
    }

    setOauthLoading(true);
    setOauthError(null);

    try {
      const url = await startStoreOAuth('woocommerce', connectStoreUrl.trim(), isOnboarding);

      // Full-page navigation to the store's own wp-admin authorization screen.
      window.location.href = url;
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Failed to start WooCommerce connection');
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to connect your store');
      return;
    }

    const validationError = validateWooCommerceInputs(storeUrl, consumerKey, consumerSecret);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The server tests the keys against the store before saving them, and
      // stores them encrypted - they are never readable from the browser again.
      await connectWooCommerceStore(normalizeStoreUrlInput(storeUrl)!, consumerKey.trim(), consumerSecret.trim());

      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        window.location.href = isOnboarding ? '/dashboard?onboarding=1' : '/dashboard';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect your WooCommerce store');
    } finally {
      setLoading(false);
    }
  };

  const keyUrl = createKeyUrl(storeUrl);

  const card = (
    <div className={`relative w-full ${standalone ? '' : 'max-w-[420px] p-8 sm:p-10 rounded-2xl bg-canvas-2 border border-white/[0.07]'} text-white font-archivo`}>
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas-2 rounded-2xl z-10">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-band-green/10 rounded-full">
                <CheckCircle className="w-8 h-8 text-band-green" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1.5">Store connected!</h3>
            <p className="text-white/45 text-sm">Successfully connected to your WooCommerce store.</p>
          </div>
        </div>
      )}

      {!standalone && (
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors text-lg leading-none">
          ×
        </button>
      )}

      {!standalone && (
        <div className="text-center mb-6">
          <h2 className="text-[22px] font-semibold tracking-tight text-white mb-2">Connect your WooCommerce store</h2>
          <p className="text-[12.5px] leading-relaxed text-white/45">
            StockPilot reads products and orders only. It never writes to your store without you confirming an action.
          </p>
        </div>
      )}

      <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-[10px] p-[3px]">
        <button
          type="button"
          onClick={() => setShowAdvanced(false)}
          className={`flex-1 py-2 rounded-[8px] font-semibold text-xs transition-colors ${
            !showAdvanced ? 'bg-white/10 text-white' : 'bg-transparent text-white/50 hover:text-white/80'
          }`}
        >
          One-click
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced(true)}
          className={`flex-1 py-2 rounded-[8px] font-semibold text-xs transition-colors ${
            showAdvanced ? 'bg-white/10 text-white' : 'bg-transparent text-white/50 hover:text-white/80'
          }`}
        >
          REST API keys
        </button>
      </div>

      {!showAdvanced && (
        <>
          {oauthError && (
            <div className="mt-[18px] p-3 rounded-lg bg-band-red/10 border border-band-red/20 text-band-red text-sm">
              {oauthError}
            </div>
          )}

          <form onSubmit={handleConnectWithWooCommerce} className="mt-[18px] flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Store URL</span>
              <input
                type="text"
                value={connectStoreUrl}
                onChange={e => setConnectStoreUrl(e.target.value)}
                placeholder="https://your-store.com"
                className="px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
            </label>

            <button
              type="submit"
              disabled={oauthLoading}
              className="py-3 rounded-[9px] bg-accent hover:bg-accent-hover text-canvas font-semibold text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {oauthLoading ? 'Redirecting to your store…' : 'Continue to WooCommerce'}
            </button>
            <p className="text-[11.5px] leading-relaxed text-white/40 text-center">
              You'll be taken to your store's admin to approve the connection, then brought back here.
            </p>
          </form>
        </>
      )}

      {showAdvanced && (
        <>
          {error && (
            <div className="mt-[18px] p-3 rounded-lg bg-band-red/10 border border-band-red/20 text-band-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-[18px] flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Store URL</span>
              <input
                type="text"
                value={storeUrl}
                onChange={e => setStoreUrl(e.target.value)}
                placeholder="https://your-store.com"
                className="px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Consumer key</span>
              <input
                type="password"
                value={consumerKey}
                onChange={e => setConsumerKey(e.target.value)}
                placeholder="ck_••••••••••••••••••••••••••••••••••••••••"
                className="px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Consumer secret</span>
              <input
                type="password"
                value={consumerSecret}
                onChange={e => setConsumerSecret(e.target.value)}
                placeholder="cs_••••••••••••••••••••••••••••••••••••••••"
                className="px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
            </label>

            {keyUrl ? (
              <a
                href={keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-accent-soft hover:text-white transition-colors"
              >
                Generate keys for this store →
              </a>
            ) : (
              <p className="text-[11.5px] leading-relaxed text-white/40">
                Generate keys under WooCommerce → Settings → Advanced → REST API in your store's admin, with at least Read access.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="py-3 rounded-[9px] bg-accent hover:bg-accent-hover text-canvas font-semibold text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Connecting…' : 'Connect store'}
            </button>
          </form>
        </>
      )}

      {onSwitchPlatform && (
        <div className="mt-[22px] pt-[18px] border-t border-white/[0.07] flex flex-col gap-2">
          <span className="font-mono-ibm text-[11px] tracking-wide text-white/35">OR ANOTHER PLATFORM</span>
          <button
            type="button"
            onClick={onSwitchPlatform}
            className="flex items-center justify-between px-3.5 py-3 rounded-[10px] border border-white/10 text-white text-[12.5px] font-medium hover:border-accent/50 transition-colors"
          >
            <span>Connect a Shopify store</span>
            <span className="text-white/40">→</span>
          </button>
        </div>
      )}
    </div>
  );

  if (standalone) return card;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      {card}
    </div>
  );
}
