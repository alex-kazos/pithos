import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { Youtube, CheckCircle } from 'lucide-react';
import { connectShopifyStore, getConfig, startStoreOAuth } from '../../services/api';

// e.g. "my-store" or "my-store.myshopify.com" - letters, digits, and hyphens only
const SHOP_URL_PATTERN = /^[a-z0-9][a-z0-9-]*(\.myshopify\.com)?\/?$/i;
// Shopify Admin API access tokens are prefixed shpat_/shpca_/shppa_ followed by hex characters
const API_TOKEN_PATTERN = /^(shpat|shpca|shppa)_[a-f0-9]{32,}$/i;

// Accept a pasted full URL (https://your-store.myshopify.com/) as readily as a bare domain.
function normalizeShopInput(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function validateShopifyInputs(shopUrl: string, apiToken: string): string | null {
  const normalizedShopUrl = normalizeShopInput(shopUrl);
  if (!normalizedShopUrl || !SHOP_URL_PATTERN.test(normalizedShopUrl)) {
    return 'Enter a valid store URL, e.g. "your-store.myshopify.com"';
  }

  const trimmedToken = apiToken.trim();
  if (!trimmedToken || !API_TOKEN_PATTERN.test(trimmedToken)) {
    return 'Enter a valid Admin API access token (starts with shpat_, shpca_, or shppa_)';
  }

  return null;
}

interface ShopifySetupProps {
  onClose: () => void;
  /** Renders just the card content, no fixed backdrop/close button - used to embed this inline in the onboarding wizard. */
  standalone?: boolean;
  /** Success redirects to /dashboard?onboarding=1 instead of /dashboard, so DashboardPage shows the first-sync screen. */
  isOnboarding?: boolean;
  /** Shown as a link to connect a different platform instead - only passed by the onboarding wizard. */
  onSwitchPlatform?: () => void;
}

export function ShopifySetup({ onClose, standalone = false, isOnboarding = false, onSwitchPlatform }: ShopifySetupProps) {
  useLockBodyScroll(!standalone);
  const [shopDomain, setShopDomain] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [shopUrl, setShopUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { user } = useAuth();

  // One-click connect needs a Shopify app configured on the server; without
  // one, open on the access-token form instead.
  useEffect(() => {
    getConfig()
      .then(config => { if (!config.shopifyOAuth) setShowAdvanced(true); })
      .catch(() => {});
  }, []);

  const handleConnectWithShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setOauthError('You must be logged in to connect your store');
      return;
    }
    const normalizedShop = normalizeShopInput(shopDomain);
    if (!SHOP_URL_PATTERN.test(normalizedShop)) {
      setOauthError('Enter a valid store URL, e.g. "your-store.myshopify.com"');
      return;
    }

    setOauthLoading(true);
    setOauthError(null);

    try {
      const url = await startStoreOAuth('shopify', normalizedShop, isOnboarding);

      // Full-page navigation to Shopify's own authorization screen.
      window.location.href = url;
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Failed to start Shopify connection');
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to connect your store');
      console.error('No user found in auth context');
      return;
    }

    const validationError = validateShopifyInputs(shopUrl, apiToken);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The server checks the token against the shop before saving it, and
      // stores it encrypted - it is never readable from the browser again.
      await connectShopifyStore(normalizeShopInput(shopUrl), apiToken.trim());

      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        // Reload the page to ensure dashboard appears with the new store data
        window.location.href = isOnboarding ? '/dashboard?onboarding=1' : '/dashboard';
      }, 2000);
    } catch (err) {
      console.error('Error during setup:', err);
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

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
            <h3 className="text-lg font-semibold text-white mb-1.5">Shop connected!</h3>
            <p className="text-white/45 text-sm">Successfully connected to your Shopify store.</p>
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
          <h2 className="text-[22px] font-semibold tracking-tight text-white mb-2">Connect your store</h2>
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
          Admin API token
        </button>
      </div>

      {!showAdvanced && (
        <>
          {oauthError && (
            <div className="mt-3.5 p-3 rounded-lg bg-band-red/10 border border-band-red/20 text-band-red text-sm">
              {oauthError}
            </div>
          )}

          <form onSubmit={handleConnectWithShopify} className="mt-[18px] flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Store URL</span>
              <input
                type="text"
                value={shopDomain}
                onChange={e => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                className="px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
              <span className="text-[11px] text-white/35">A full pasted URL works too</span>
            </label>

            <button
              type="submit"
              disabled={oauthLoading}
              className="py-3 rounded-[9px] bg-accent hover:bg-accent-hover text-canvas font-semibold text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {oauthLoading ? 'Redirecting to Shopify…' : 'Continue to Shopify'}
            </button>
            <p className="text-[11.5px] leading-relaxed text-white/40 text-center">
              You approve the read-only scopes on Shopify, then land back here.
            </p>
          </form>
        </>
      )}

      {showAdvanced && (
        <>
          {error && (
            <div className="mt-3.5 p-3 rounded-lg bg-band-red/10 border border-band-red/20 text-band-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-[18px] flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Store URL</span>
              <input
                type="text"
                value={shopUrl}
                onChange={e => setShopUrl(e.target.value)}
                placeholder="your-store.myshopify.com"
                className="px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-white/60">Admin API access token</span>
              <input
                type="password"
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
                placeholder="shpat_••••••••••••••••••••••••••••••••"
                className="px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60"
                required
              />
              <span className="text-[11px] text-white/35">Starts with shpat_, shpca_ or shppa_</span>
            </label>

            <a
              href="https://www.youtube.com/watch?v=FQacvKAOWtc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-medium text-accent-soft hover:text-white transition-colors"
            >
              <Youtube className="w-3.5 h-3.5" />
              How do I create an Admin API token? →
            </a>

            <button
              type="submit"
              disabled={loading}
              className="py-3 rounded-[9px] bg-accent hover:bg-accent-hover text-canvas font-semibold text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Connecting…' : 'Connect store'}
            </button>
            <p className="text-[11.5px] leading-relaxed text-white/40 text-center">
              We verify the token against your products endpoint before saving it.
            </p>
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
            <span>Connect a WooCommerce store</span>
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
