export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date
  readingTimeMinutes: number;
  tags: string[];
  content: string; // markdown
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'shopify-inventory-management-guide',
    title: 'Shopify Inventory Management: How to Stop Losing Sales to Stockouts',
    description: 'A practical guide to Shopify inventory management: why stockouts happen, how to forecast demand, and how AI-powered restocking alerts prevent lost sales.',
    publishedAt: '2026-08-15',
    readingTimeMinutes: 6,
    tags: ['Shopify', 'Inventory Management'],
    content: `Running out of your best-selling product is one of the most avoidable ways to lose revenue on Shopify. A customer lands on your store ready to buy, sees "Sold Out," and leaves - often for a competitor. Fixing this isn't about buying more stock across the board; it's about knowing which SKUs need attention before you run out.

## Why Shopify stores run into stockouts

Most stockouts trace back to the same handful of causes:

- **Manual reorder tracking.** Spreadsheets and gut-feel reorder points don't scale past a few dozen SKUs, and they don't account for seasonality or trending products.
- **No visibility across sales channels.** If you sell on Shopify and elsewhere, stock can look fine in one place while it's already gone in another.
- **Reacting instead of forecasting.** By the time a product shows as low-stock in your Shopify admin, you've often already lost days of potential reorder lead time.

## What good Shopify inventory management actually looks like

The stores that avoid stockouts consistently do three things well:

1. **Track sales velocity per SKU, not just current stock levels.** A product with 20 units left and 2 units/week of sales is fine. A product with 20 units left and 15 units/week of sales is a problem - even though the raw stock number looks identical.
2. **Set reorder points based on lead time, not intuition.** If your supplier takes three weeks to restock, your reorder point needs to account for three weeks of expected demand, not "whenever it looks low."
3. **Get alerted before it's urgent.** The best inventory tools flag a product when it's trending toward a stockout, not after it's already sold out.

## How AI-powered forecasting helps

This is where a rules-based spreadsheet starts to break down and AI forecasting earns its keep. Instead of a flat reorder threshold, a model that looks at recent sales trends, seasonality, and current stock can flag "this SKU will likely sell out in 9 days at current velocity" - which is a fundamentally more useful signal than "stock is below 10 units."

StockPilot connects directly to your Shopify store (a one-click OAuth connection - no API keys to copy or paste) and continuously analyzes your product and order data to surface exactly this kind of recommendation: which SKUs are trending toward a stockout, which are overstocked and tying up capital, and what the estimated revenue impact is either way.

## Getting started

If you're currently tracking reorder points in a spreadsheet, the fastest win is simply connecting your real sales data to something that can see trends automatically. You don't need to overhaul your entire operation - start by identifying your top 10-20 SKUs by revenue and making sure you have real visibility into their sales velocity, not just their current stock count.

[See how StockPilot works with Shopify →](/auth)`,
  },
  {
    slug: 'woocommerce-inventory-management-guide',
    title: 'WooCommerce Inventory Management: A Practical Guide for Growing Stores',
    description: 'WooCommerce inventory management gets harder as you scale past a handful of products. Here\'s how to track stock accurately and forecast demand without a spreadsheet.',
    publishedAt: '2026-08-22',
    readingTimeMinutes: 6,
    tags: ['WooCommerce', 'Inventory Management'],
    content: `WooCommerce gives you a lot of flexibility - and unlike hosted platforms, it also gives you a lot of rope to hang yourself with when it comes to inventory. There's no single dashboard nudging you toward best practices, so stock tracking is entirely up to how you set things up.

## The specific challenges WooCommerce stores run into

- **Plugin sprawl.** Many WooCommerce stores stitch together separate plugins for stock tracking, low-stock alerts, and reporting - and those tools don't always agree with each other.
- **Variable products complicate reorder logic.** A T-shirt in 5 sizes and 3 colors is 15 SKUs, each with its own sales velocity, but WooCommerce's default stock view doesn't make it easy to see which specific variant is about to run out.
- **No built-in forecasting.** WooCommerce will tell you current stock. It won't tell you that a variant is on track to sell out in eight days.

## What to track instead of just "stock remaining"

The stores that manage WooCommerce inventory well typically shift their attention from a single "stock count" number to three related signals:

1. **Sales velocity per variation**, not per parent product - since a single popular size or color can sell out while the product overall still shows healthy stock.
2. **Days-of-stock-remaining at current velocity**, which is a far more actionable number than a raw unit count.
3. **Revenue at risk**, i.e., what a stockout on a specific SKU actually costs you if it goes unresolved for a week.

## Where AI forecasting fits in

Once you're managing more than a handful of products, doing this analysis by hand in a spreadsheet stops being practical. An AI model that has access to your real order history can flag which specific variants are trending toward a stockout, and estimate the revenue impact of restocking (or not) - the same kind of insight a dedicated analyst would give you, generated automatically from data you already have.

StockPilot connects to WooCommerce through a one-click authorization flow (no manually generating and pasting API keys), then continuously analyzes your products and orders to surface exactly these kinds of recommendations alongside a live view of stock vs. sales.

## A practical starting point

If your WooCommerce store is still on manual stock checks, start by identifying your highest-revenue variable products and getting real visibility into per-variant sales velocity - that's usually where the most money is quietly at risk.

[See how StockPilot works with WooCommerce →](/auth)`,
  },
  {
    slug: 'stockpilot-vs-cin7-katana-ordoro',
    title: 'StockPilot vs Cin7, Katana MRP, and Ordoro: Which Inventory Tool Fits Your Store?',
    description: 'Comparing StockPilot to Cin7, Katana MRP, and Ordoro for Shopify and WooCommerce inventory management - use case, complexity, and who each tool is actually built for.',
    publishedAt: '2026-08-28',
    readingTimeMinutes: 7,
    tags: ['Comparison', 'Inventory Management'],
    content: `There's no single "best" inventory tool - the right choice depends heavily on what kind of business you're running. Here's an honest look at how StockPilot compares to a few well-known names in the space, so you can figure out which one actually fits.

## Cin7

Cin7 is built for businesses managing inventory across many channels at once - physical retail, multiple online marketplaces, and wholesale, often with a large number of integrations. It's a strong fit if you need to unify inventory across a complex, multi-channel operation and are prepared for the setup and cost that comes with a platform of that scope.

**Consider Cin7 if:** you're running inventory across several sales channels simultaneously (retail POS, multiple marketplaces, wholesale) and need one system to reconcile all of it.

## Katana MRP

Katana is purpose-built for manufacturers - it tracks raw materials, manages production scheduling, and handles batch tracing through a build process. If you're assembling or manufacturing products rather than reselling finished goods, that production-focused tooling is hard to replace with a general inventory tool.

**Consider Katana if:** you manufacture or assemble your own products and need production scheduling and materials tracking, not just finished-goods stock counts.

## Ordoro

Ordoro is popular with Shopify merchants who need strong shipping and fulfillment tooling alongside inventory - particularly stores running a dropshipping model with multiple suppliers, where order routing complexity is the main pain point.

**Consider Ordoro if:** shipping/fulfillment logistics and dropshipping order routing are your primary operational headache, more so than demand forecasting.

## Where StockPilot fits

StockPilot is built specifically for Shopify and WooCommerce sellers who want AI-driven demand forecasting and restocking recommendations without taking on the setup complexity of a full multi-channel ERP or manufacturing system. The focus is narrow on purpose: connect your store in one click, and get clear, prioritized recommendations on what to restock, what's overstocked, and what it's worth in revenue - plus a chat interface to ask questions about your own inventory and sales data directly.

**Consider StockPilot if:** you sell on Shopify and/or WooCommerce, you're not manufacturing your own goods or juggling a dozen sales channels, and what you actually want is AI-powered demand forecasting that's simple to set up and use day-to-day.

## The honest takeaway

If your operation has outgrown a single storefront and needs full multi-channel reconciliation, Cin7 is worth evaluating. If you manufacture your own products, Katana is worth evaluating. If dropshipping logistics are your bottleneck, look at Ordoro. If what you need is straightforward, AI-powered inventory forecasting for a Shopify or WooCommerce store without extra operational overhead, that's exactly what StockPilot is built for.

[Try StockPilot free →](/auth)`,
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}
