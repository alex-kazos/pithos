import React from 'react';

interface OverviewWidgetCardProps {
  title: string;
  sub?: string;
  span: 1 | 2 | 3;
  children: React.ReactNode;
}

/** A single preset card: title/sub header plus kind-specific content (rendered by the caller). No per-card chrome - presets aren't user-editable per-card, only switchable as a whole. */
export function OverviewWidgetCard({ title, sub, span, children }: OverviewWidgetCardProps) {
  return (
    <div
      style={{ gridColumn: `span ${span}` }}
      className="flex flex-col p-4 rounded-xl bg-surface border border-white/10 min-w-0"
    >
      <div className="min-w-0">
        <div className="font-archivo font-semibold text-[13.5px] leading-tight text-white text-pretty">{title}</div>
        {sub && <p className="mt-1 font-archivo text-[11.5px] leading-snug text-white/40">{sub}</p>}
      </div>
      <div className="mt-3 flex-1 min-w-0">{children}</div>
    </div>
  );
}
