import { Check } from 'lucide-react';

interface SyncStep {
  label: string;
  meta: string;
  state: 'done' | 'active' | 'pending';
}

const SYNC_STEPS: SyncStep[] = [
  { label: 'Products and variants', meta: 'syncing', state: 'active' },
  { label: 'Order history', meta: 'queued', state: 'pending' },
  { label: 'Building demand forecasts', meta: 'queued', state: 'pending' },
  { label: 'First AI recommendations', meta: 'queued', state: 'pending' },
];

interface FirstSyncScreenProps {
  storeName: string;
}

/** Shown right after a store connects, while the first data sync is still running server-side. */
export function FirstSyncScreen({ storeName }: FirstSyncScreenProps) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6 font-archivo">
      <div className="w-full max-w-[420px] p-8 sm:p-10 rounded-2xl bg-canvas-2 border border-white/[0.07] text-white text-center">
        <div className="w-11 h-11 mx-auto rounded-[13px] bg-band-green/[0.14] border border-band-green/30 flex items-center justify-center">
          <Check className="w-[18px] h-[18px] text-[#7fd4a8]" strokeWidth={3} />
        </div>
        <h1 className="mt-[18px] text-[21px] font-semibold tracking-tight">{storeName} is connected</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/45">
          Pulling your products and order history. You can leave this page — we'll email you when the first recommendations are ready.
        </p>

        <div className="mt-6 flex flex-col gap-[11px] text-left">
          {SYNC_STEPS.map(s => (
            <div
              key={s.label}
              className={`flex items-center gap-[11px] px-3.5 py-[11px] rounded-[10px] border ${
                s.state === 'active' ? 'bg-accent/[0.08] border-accent/[0.28]' : 'bg-white/[0.025] border-white/[0.06]'
              }`}
            >
              <span
                className={`flex-none w-[18px] h-[18px] rounded-full flex items-center justify-center font-semibold text-[9px] ${
                  s.state === 'done'
                    ? 'bg-band-green/[0.18] text-[#7fd4a8]'
                    : s.state === 'active'
                      ? 'bg-accent text-canvas'
                      : 'bg-white/[0.07] text-canvas'
                }`}
              >
                {s.state === 'done' ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : s.state === 'active' ? '·' : ''}
              </span>
              <span className={`flex-1 text-[12.5px] font-medium ${s.state === 'pending' ? 'text-white/40' : 'text-white'}`}>
                {s.label}
              </span>
              <span className="font-mono-ibm text-[11px] text-white/35">{s.meta}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[11.5px] text-white/35">Typically under two minutes for a catalogue this size</p>
      </div>
    </div>
  );
}
