/**
 * Fully synthetic data for the public "/demo" experience - two fictional
 * stores that exist only in this file. None of it is read from or written
 * to the database, Shopify, WooCommerce, or any real account: it exists purely
 * so an anonymous visitor can see the dashboard's visuals populated with
 * realistic-looking numbers before signing up.
 */
import { DashboardProduct, DashboardOrder } from '../types/dashboard';
import type { CachedRecommendations, Recommendation } from '../utils/openai';

export interface DemoStore {
  id: string;
  name: string;
  type: 'shopify' | 'woocommerce';
}

export const DEMO_STORES: DemoStore[] = [
  { id: 'demo-aurora-coffee', name: 'aurora-coffee-roasters.myshopify.com', type: 'shopify' },
  { id: 'demo-nimbus-streetwear', name: 'nimbus-streetwear.com', type: 'woocommerce' },
];

export const DEFAULT_DEMO_STORE_ID = DEMO_STORES[0].id;

interface DemoProductSpec {
  id: string;
  name: string;
  sku: string;
  productType: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  /** Average units sold per week, held roughly constant (with jitter) across the whole year of generated orders. 0 means genuinely dead stock. */
  weeklyVelocity: number;
}

// Deterministic PRNG so the demo looks the same on every load instead of
// reshuffling each time a visitor refreshes the page.
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEEKS_OF_HISTORY = 52;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildStore(specs: DemoProductSpec[], seed: number): { products: DashboardProduct[]; orders: DashboardOrder[] } {
  const random = mulberry32(seed);
  const now = new Date();

  const products: DashboardProduct[] = specs.map(spec => ({
    id: spec.id,
    name: spec.name,
    sku: spec.sku,
    stock: spec.stock,
    product_type: spec.productType,
    sales: 0,
    revenue: 0,
    variants: [
      {
        id: `${spec.id}-v1`,
        sku: spec.sku,
        inventory_quantity: spec.stock,
        price: spec.price.toFixed(2),
        compare_at_price: spec.compareAtPrice ? spec.compareAtPrice.toFixed(2) : undefined,
      },
    ],
    created_at: new Date(now.getTime() - 420 * MS_PER_DAY).toISOString(),
    updated_at: now.toISOString(),
    status: 'active',
    vendor: 'Demo',
    price: spec.price.toFixed(2),
    compare_at_price: spec.compareAtPrice ? spec.compareAtPrice.toFixed(2) : spec.price.toFixed(2),
  }));

  const orders: DashboardOrder[] = [];
  let orderNumber = 10000 + seed;
  let lineItemId = 1;

  for (let weeksAgo = WEEKS_OF_HISTORY - 1; weeksAgo >= 0; weeksAgo--) {
    const orderDate = new Date(now.getTime() - weeksAgo * 7 * MS_PER_DAY);
    const lineItems: DashboardOrder['line_items'] = [];

    specs.forEach(spec => {
      if (spec.weeklyVelocity <= 0) return;
      const jitter = 0.55 + random() * 0.9; // 0.55x - 1.45x of the target weekly rate
      const units = Math.max(0, Math.round(spec.weeklyVelocity * jitter));
      if (units <= 0) return;

      lineItems.push({
        id: `${lineItemId++}`,
        product_id: spec.id,
        variant_id: `${spec.id}-v1`,
        quantity: units,
        price: spec.price.toFixed(2),
      });
    });

    if (lineItems.length === 0) continue;

    const totalPrice = lineItems.reduce((sum, item) => sum + item.quantity * parseFloat(item.price), 0);

    orders.push({
      id: `${orderNumber}`,
      order_number: orderNumber,
      created_at: orderDate.toISOString(),
      total_price: totalPrice.toFixed(2),
      line_items: lineItems,
      financial_status: 'paid',
      fulfillment_status: 'fulfilled',
    });
    orderNumber++;
  }

  return { products, orders };
}

const AURORA_COFFEE_SPECS: DemoProductSpec[] = [
  { id: 'aur-1', name: 'Espresso Blend 1kg', sku: 'AUR-ESP-1KG', productType: 'Whole Bean', price: 22, stock: 6, weeklyVelocity: 5 },
  { id: 'aur-2', name: 'Coffee Grinder — Manual', sku: 'AUR-GRD-MAN', productType: 'Equipment', price: 48, stock: 4, weeklyVelocity: 3 },
  { id: 'aur-3', name: 'Single-Origin Ethiopia 250g', sku: 'AUR-ETH-250', productType: 'Whole Bean', price: 14, stock: 30, weeklyVelocity: 6 },
  { id: 'aur-4', name: 'Pour-Over Starter Kit', sku: 'AUR-POK-01', productType: 'Equipment', price: 36, stock: 18, weeklyVelocity: 4 },
  { id: 'aur-5', name: 'House Blend 1kg', sku: 'AUR-HSE-1KG', productType: 'Whole Bean', price: 19, stock: 80, weeklyVelocity: 9 },
  { id: 'aur-6', name: 'Decaf Colombia 250g', sku: 'AUR-DEC-250', productType: 'Whole Bean', price: 15, stock: 60, weeklyVelocity: 7 },
  { id: 'aur-7', name: 'Espresso Cup Set (4pc)', sku: 'AUR-CUP-4PC', productType: 'Accessories', price: 28, compareAtPrice: 34, stock: 70, weeklyVelocity: 8 },
  { id: 'aur-8', name: 'Cold Brew Concentrate 1L', sku: 'AUR-CLD-1L', productType: 'Ready to Drink', price: 12, stock: 150, weeklyVelocity: 5 },
  { id: 'aur-9', name: 'Reusable Paper Filter Pack', sku: 'AUR-FLT-PK', productType: 'Accessories', price: 9, stock: 200, weeklyVelocity: 6 },
  { id: 'aur-10', name: 'French Press 1L', sku: 'AUR-FPR-1L', productType: 'Equipment', price: 32, stock: 40, weeklyVelocity: 0 },
];

const NIMBUS_STREETWEAR_SPECS: DemoProductSpec[] = [
  { id: 'nim-1', name: 'Nimbus Logo Hoodie', sku: 'NIM-HOD-BLK', productType: 'Hoodies', price: 58, compareAtPrice: 68, stock: 7, weeklyVelocity: 6 },
  { id: 'nim-2', name: 'Limited Cloud Sneaker', sku: 'NIM-SNK-CLD', productType: 'Footwear', price: 95, stock: 5, weeklyVelocity: 4 },
  { id: 'nim-3', name: 'Essential Crewneck Tee', sku: 'NIM-TEE-CRW', productType: 'T-Shirts', price: 26, stock: 34, weeklyVelocity: 7 },
  { id: 'nim-4', name: 'Nylon Track Jacket', sku: 'NIM-JKT-TRK', productType: 'Jackets', price: 72, stock: 20, weeklyVelocity: 4 },
  { id: 'nim-5', name: 'Relaxed Fit Joggers', sku: 'NIM-JOG-RLX', productType: 'Bottoms', price: 54, stock: 85, weeklyVelocity: 9 },
  { id: 'nim-6', name: 'Ribbed Beanie', sku: 'NIM-BEA-RIB', productType: 'Accessories', price: 18, stock: 65, weeklyVelocity: 7 },
  { id: 'nim-7', name: 'Canvas Tote Bag', sku: 'NIM-TOT-CNV', productType: 'Accessories', price: 22, stock: 75, weeklyVelocity: 8 },
  { id: 'nim-8', name: 'Crew Socks 3-Pack', sku: 'NIM-SOC-3PK', productType: 'Accessories', price: 16, stock: 160, weeklyVelocity: 5 },
  { id: 'nim-9', name: 'Everyday Backpack', sku: 'NIM-BAG-EVD', productType: 'Bags', price: 64, stock: 210, weeklyVelocity: 6 },
  { id: 'nim-10', name: 'Retro Windbreaker', sku: 'NIM-WND-RTR', productType: 'Jackets', price: 66, stock: 48, weeklyVelocity: 0 },
];

const aurora = buildStore(AURORA_COFFEE_SPECS, 1);
const nimbus = buildStore(NIMBUS_STREETWEAR_SPECS, 2);

export const DEMO_PRODUCTS: Record<string, DashboardProduct[]> = {
  [DEMO_STORES[0].id]: aurora.products,
  [DEMO_STORES[1].id]: nimbus.products,
};

export const DEMO_ORDERS: Record<string, DashboardOrder[]> = {
  [DEMO_STORES[0].id]: aurora.orders,
  [DEMO_STORES[1].id]: nimbus.orders,
};

const GENERATED_AT = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const AURORA_RECOMMENDATIONS: Recommendation[] = [
  {
    type: 'RESTOCK',
    priority: 'HIGH',
    sku: 'AUR-ESP-1KG',
    product_type: 'Whole Bean',
    message: 'Espresso Blend 1kg is down to 6 units with steady weekly demand — it will sell out in just over a week at the current pace.',
    prediction: 'Projected stockout in ~8 days without a reorder.',
  },
  {
    type: 'RESTOCK',
    priority: 'HIGH',
    sku: 'AUR-GRD-MAN',
    product_type: 'Equipment',
    message: 'Coffee Grinder — Manual has only 4 units left and continues to sell a few units every week.',
    prediction: 'Projected stockout in under 2 weeks.',
  },
  {
    type: 'WARNING',
    priority: 'MEDIUM',
    sku: 'AUR-POK-01',
    product_type: 'Equipment',
    message: 'Pour-Over Starter Kit has roughly 4.5 weeks of cover left, below your 6-week reorder point.',
    prediction: 'Will cross into stockout risk within a month if unaddressed.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'LOW',
    sku: 'AUR-FPR-1L',
    product_type: 'Equipment',
    message: 'French Press 1L has had zero sales this year despite 40 units on hand — consider bundling it with a bean subscription or discounting it.',
    prediction: 'Currently tying up idle capital with no sell-through.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'MEDIUM',
    sku: 'AUR-CUP-4PC',
    product_type: 'Accessories',
    message: 'Espresso Cup Set is one of your fastest sellers and is already marked down from $34 to $28 — a full-price push once stock is replenished could lift margin.',
    prediction: 'Strong, consistent sell-through across the last 12 months.',
  },
  {
    type: 'WARNING',
    priority: 'MEDIUM',
    sku: 'AUR-ETH-250',
    product_type: 'Whole Bean',
    message: 'Single-Origin Ethiopia 250g is at 30 units against roughly 7 a week — about 4.3 weeks of cover, under your 6-week reorder point.',
    prediction: 'Drops below two weeks of cover by the end of the month at this pace.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'LOW',
    sku: 'AUR-CLD-1L',
    product_type: 'Ready to Drink',
    message: 'Cold Brew Concentrate 1L holds 150 units — nearly 26 weeks of cover, more than double your 12-week ceiling. Order less on the next cycle rather than discounting.',
    prediction: 'Sells steadily, so this corrects itself if you simply skip a reorder.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'LOW',
    sku: 'AUR-FLT-PK',
    product_type: 'Accessories',
    message: 'Reusable Paper Filter Pack is your largest position at 200 units and nearly 29 weeks of cover, but it is cheap stock — the tied-up capital is modest.',
    prediction: 'Low risk: demand is consistent, only the order size is oversized.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'MEDIUM',
    sku: 'AUR-HSE-1KG',
    product_type: 'Whole Bean',
    message: 'House Blend 1kg moves about 9 units a week with 8.6 weeks of cover — your healthiest bean. It is the safest candidate for a subscription bundle.',
    prediction: 'Cover and sell-through have both held range for two quarters.',
  },
];

const NIMBUS_RECOMMENDATIONS: Recommendation[] = [
  {
    type: 'RESTOCK',
    priority: 'HIGH',
    sku: 'NIM-HOD-BLK',
    product_type: 'Hoodies',
    message: 'Nimbus Logo Hoodie is down to 7 units and remains your steadiest seller — expect a stockout within a week and a half.',
    prediction: 'Projected stockout in ~8 days without a reorder.',
  },
  {
    type: 'RESTOCK',
    priority: 'HIGH',
    sku: 'NIM-SNK-CLD',
    product_type: 'Footwear',
    message: 'Limited Cloud Sneaker has only 5 pairs left across all sizes combined.',
    prediction: 'Projected stockout in under 2 weeks.',
  },
  {
    type: 'WARNING',
    priority: 'MEDIUM',
    sku: 'NIM-JKT-TRK',
    product_type: 'Jackets',
    message: 'Nylon Track Jacket has about 5 weeks of cover left, below your 6-week reorder point.',
    prediction: 'Will cross into stockout risk within a month if unaddressed.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'LOW',
    sku: 'NIM-WND-RTR',
    product_type: 'Jackets',
    message: 'Retro Windbreaker has had zero sales this year with 48 units sitting in stock — worth a seasonal promotion or bundling with the track jacket.',
    prediction: 'Currently tying up idle capital with no sell-through.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'MEDIUM',
    sku: 'NIM-JOG-RLX',
    product_type: 'Bottoms',
    message: 'Relaxed Fit Joggers is your highest-velocity SKU and still 12+ weeks from running low — a great candidate for a paid ads push.',
    prediction: 'Strong, consistent sell-through across the last 12 months.',
  },
  {
    type: 'WARNING',
    priority: 'MEDIUM',
    sku: 'NIM-TEE-CRW',
    product_type: 'T-Shirts',
    message: 'Essential Crewneck Tee sits at 34 units against about 7 a week — roughly 4.7 weeks of cover, under your 6-week reorder point.',
    prediction: 'Crosses into stockout risk within a month if left alone.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'LOW',
    sku: 'NIM-BAG-EVD',
    product_type: 'Bags',
    message: 'Everyday Backpack is your biggest tied-up position: 210 units at $64 against 6 sales a week. That is the single largest block of capital on the shelf.',
    prediction: 'Demand is real but slow — order less rather than discounting.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'LOW',
    sku: 'NIM-SOC-3PK',
    product_type: 'Accessories',
    message: 'Crew Socks 3-Pack holds 160 units at about 5 a week — over 30 weeks of cover. Cheap stock, but it is shelf space a faster accessory could use.',
    prediction: 'Low risk, low return: worth bundling with tees to move faster.',
  },
  {
    type: 'OPPORTUNITY',
    priority: 'MEDIUM',
    sku: 'NIM-TOT-CNV',
    product_type: 'Accessories',
    message: 'Canvas Tote Bag moves about 8 a week with a healthy cover position — your strongest accessory, and an easy add-on at checkout.',
    prediction: 'Sell-through has held its range across the last two quarters.',
  },
];

/** How many of a store's pool are surfaced at once - the rest rotate in on each demo sync. */
const VISIBLE_RECOMMENDATIONS = 5;

const DEMO_RECOMMENDATION_POOL: Record<string, Recommendation[]> = {
  [DEMO_STORES[0].id]: AURORA_RECOMMENDATIONS,
  [DEMO_STORES[1].id]: NIMBUS_RECOMMENDATIONS,
};

/**
 * Rotates a window over the store's recommendation pool so pressing Sync in
 * the demo surfaces a different set, the way a real regeneration would,
 * instead of replaying the same five forever. Every entry stays consistent
 * with the store's actual numbers, so a rotated card never contradicts the
 * dashboard behind it.
 */
export function getDemoRecommendations(storeId: string, cycle: number): CachedRecommendations {
  const pool = DEMO_RECOMMENDATION_POOL[storeId] ?? [];
  const count = Math.min(VISIBLE_RECOMMENDATIONS, pool.length);
  const offset = pool.length ? ((cycle % pool.length) + pool.length) % pool.length : 0;

  return {
    recommendations: Array.from({ length: count }, (_, i) => pool[(offset + i) % pool.length]),
    // First paint keeps the "2h ago" framing; a sync reads as freshly generated.
    generatedAt: cycle === 0 ? GENERATED_AT : new Date().toISOString(),
    isStale: false,
  };
}

export const DEMO_RECOMMENDATIONS: Record<string, CachedRecommendations> = {
  [DEMO_STORES[0].id]: { recommendations: AURORA_RECOMMENDATIONS.slice(0, VISIBLE_RECOMMENDATIONS), generatedAt: GENERATED_AT, isStale: false },
  [DEMO_STORES[1].id]: { recommendations: NIMBUS_RECOMMENDATIONS.slice(0, VISIBLE_RECOMMENDATIONS), generatedAt: GENERATED_AT, isStale: false },
};
