export type DashboardWidgetKind = 'kpi' | 'bars' | 'cards' | 'list' | 'rows' | 'table' | 'chips';

export interface DashboardWidgetDef {
  id: string;
  title: string;
  kind: DashboardWidgetKind;
  /** Static subtitle. Widgets whose subtitle depends on live data (e.g. "recs") compute it at render time instead. */
  sub?: string;
}

export const DASHBOARD_WIDGET_CATALOG: Record<string, DashboardWidgetDef> = {
  'kpi-units': { id: 'kpi-units', title: 'Units on hand', kind: 'kpi' },
  'kpi-sell': { id: 'kpi-sell', title: 'Sell-through 30d', kind: 'kpi' },
  'kpi-cover': { id: 'kpi-cover', title: 'Median cover', kind: 'kpi' },
  'kpi-dead': { id: 'kpi-dead', title: 'Capital in dead stock', kind: 'kpi' },
  cover: { id: 'cover', title: 'Weeks of cover', kind: 'bars', sub: 'Stock ÷ 30-day velocity, sorted by urgency' },
  recs: { id: 'recs', title: 'AI recommendations', kind: 'cards' },
  attention: { id: 'attention', title: 'Needs attention', kind: 'list' },
  forecast: { id: 'forecast', title: 'Forecast confidence', kind: 'rows', sub: '30-day demand and how much to trust it' },
  products: { id: 'products', title: 'Products', kind: 'table', sub: 'Stock, sold and cover per SKU' },
  chat: { id: 'chat', title: 'Ask about your stock', kind: 'chips' },
};

export interface DashboardPresetWidget {
  id: string;
  span: 1 | 2 | 3;
}

export interface DashboardPreset {
  id: string;
  name: string;
  who: string;
  blurb: string;
  layout: DashboardPresetWidget[];
  /** Kept resolvable by id (getPreset), but left out of the preset pickers for now. */
  hidden?: boolean;
}

/**
 * Overview ships four fixed presets instead of a per-user layout editor - a
 * store's Overview looks the same for everyone with access to it, so "the
 * top card" means the same thing to the whole team. Verbatim from the
 * redesign handoff's presetDefs().
 */
export const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: 'triage',
    name: 'Daily triage',
    who: 'Shop owner · five minutes a morning',
    blurb: 'What needs a decision today, with just enough number to justify it.',
    layout: [
      { id: 'kpi-dead', span: 1 },
      { id: 'kpi-cover', span: 1 },
      { id: 'kpi-sell', span: 1 },
      { id: 'recs', span: 2 },
      { id: 'attention', span: 1 },
      { id: 'cover', span: 2 },
      { id: 'chat', span: 1 },
    ],
  },
  {
    id: 'buying',
    name: 'Buying desk',
    who: 'Whoever writes the purchase orders',
    blurb: 'Reorders first, then cover and forecast confidence to size them.',
    layout: [
      { id: 'recs', span: 3 },
      { id: 'cover', span: 2 },
      { id: 'attention', span: 1 },
      { id: 'forecast', span: 2 },
      { id: 'kpi-cover', span: 1 },
    ],
  },
  {
    id: 'numbers',
    name: 'Numbers first',
    who: 'Anyone reporting upward',
    blurb: 'Three headline metrics, then the full SKU table underneath.',
    hidden: true,
    // Reordered from the handoff's literal [kpi-units, kpi-sell, kpi-cover,
    // kpi-dead, products, cover] and dropped kpi-cover (Median cover) - the
    // original 6-card spans (1+1+1+1+2+1=7) never fill an exact number of
    // rows no matter the order, always leaving a gap or forcing a widened
    // card somewhere. Five cards (1+1+1+1+2=6) fill exactly two full rows.
    layout: [
      { id: 'kpi-dead', span: 1 },
      { id: 'kpi-units', span: 1 },
      { id: 'kpi-sell', span: 1 },
      { id: 'cover', span: 1 },
      { id: 'products', span: 2 },
    ],
  },
  {
    id: 'clearance',
    name: 'Clearance watch',
    who: 'When capital is stuck in stock',
    blurb: 'Dead stock and overstock in front, reorders out of the way.',
    layout: [
      { id: 'kpi-dead', span: 1 },
      { id: 'kpi-units', span: 1 },
      { id: 'kpi-sell', span: 1 },
      { id: 'cover', span: 3 },
      { id: 'products', span: 2 },
      { id: 'chat', span: 1 },
    ],
  },
];

export const DEFAULT_PRESET_ID = 'triage';

/** Presets offered in the switcher/picker UIs - excludes hidden ones without dropping their definitions. */
export const VISIBLE_DASHBOARD_PRESETS = DASHBOARD_PRESETS.filter(p => !p.hidden);

export function getPreset(id: string): DashboardPreset {
  return DASHBOARD_PRESETS.find(p => p.id === id) ?? DASHBOARD_PRESETS[0];
}
