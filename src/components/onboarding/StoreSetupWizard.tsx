import { useState } from 'react';
import { Check } from 'lucide-react';
import { ShopifySetup } from '../integrations/ShopifySetup';
import { WooCommerceSetup } from '../integrations/WooCommerceSetup';

const STEPS = [
  { n: 1, label: 'Account' },
  { n: 2, label: 'Store' },
];

export function StoreSetupWizard() {
  const [platform, setPlatform] = useState<'shopify' | 'woocommerce'>('shopify');

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6 font-archivo">
      <div className="w-full max-w-[420px] p-8 sm:p-10 rounded-2xl bg-canvas-2 border border-white/[0.07] text-white">
        <div className="flex justify-center gap-2">
          {STEPS.map(s => (
            <div key={s.n} className="flex items-center gap-1.5">
              <span
                className={`w-[18px] h-[18px] rounded-full border font-mono-ibm text-[9.5px] font-semibold flex items-center justify-center ${
                  s.n === 2
                    ? 'bg-accent text-canvas border-accent'
                    : s.n < 2
                      ? 'bg-band-green/[0.16] text-[#7fd4a8] border-band-green/30'
                      : 'bg-transparent text-white/40 border-white/[0.14]'
                }`}
              >
                {s.n < 2 ? <Check className="w-2.5 h-2.5" /> : s.n}
              </span>
              <span className={`text-[11px] font-medium ${s.n === 2 ? 'text-white' : 'text-white/40'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-[22px] font-semibold tracking-tight">Connect your store</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/45">
            StockPilot reads products and orders only. It never writes to your store without you confirming an action.
          </p>
        </div>

        <div className="mt-[22px]">
          {platform === 'shopify' ? (
            <ShopifySetup
              standalone
              isOnboarding
              onClose={() => {}}
              onSwitchPlatform={() => setPlatform('woocommerce')}
            />
          ) : (
            <WooCommerceSetup
              standalone
              isOnboarding
              onClose={() => {}}
              onSwitchPlatform={() => setPlatform('shopify')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
