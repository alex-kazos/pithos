import type { InventoryBand } from '../utils/inventoryMetrics';

/** Shared band presentation - color/label/pill tokens reused by every inventory-health widget so a "healthy" SKU reads the same everywhere. */
export const BAND_LABEL: Record<InventoryBand, string> = {
  stockout: 'Stockout risk',
  reorder: 'Reorder',
  healthy: 'Healthy',
  overstock: 'Overstock',
};

export const BAND_DOT: Record<InventoryBand, string> = {
  stockout: 'bg-band-red',
  reorder: 'bg-band-amber',
  healthy: 'bg-band-green',
  overstock: 'bg-band-blue',
};

export const BAND_TEXT: Record<InventoryBand, string> = {
  stockout: 'text-band-red',
  reorder: 'text-band-amber',
  healthy: 'text-band-green',
  overstock: 'text-band-blue',
};

export const BAND_PILL_BG: Record<InventoryBand, string> = {
  stockout: 'bg-band-red/[0.16]',
  reorder: 'bg-band-amber/[0.16]',
  healthy: 'bg-band-green/[0.16]',
  overstock: 'bg-band-blue/[0.16]',
};

export const BAND_HEX: Record<InventoryBand, string> = {
  stockout: '#f0655c',
  reorder: '#e0a341',
  healthy: '#5ec089',
  overstock: '#6b7aff',
};
