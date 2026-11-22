import pg from 'pg';
import mysql from 'mysql2/promise';
import { lookup } from 'node:dns/promises';
import { connect as netConnect, isIP } from 'node:net';

/**
 * "Bring your own database": instead of a Shopify/WooCommerce API, the
 * merchant points Pithos at their own PostgreSQL or MySQL/MariaDB database
 * and gives it two SQL queries - one for products, one for order line
 * items - whose columns use the names below. Rows are adapted into the same
 * ShopifyProduct / ShopifyOrder shape the WooCommerce adapter produces
 * (src/services/woocommerceService.ts), so the dashboard needs nothing new.
 *
 * Safety, in layers:
 *  - every query runs in a READ ONLY transaction with a statement timeout,
 *    as exactly one statement (Postgres: extended protocol; MySQL:
 *    multi-statements off) - so no `; DROP ...`;
 *  - it is wrapped as a subquery with a row cap, so a runaway query can't
 *    exhaust this server's memory;
 *  - the host is resolved here and the connection goes to that exact IP,
 *    which must be public unless the operator sets
 *    ALLOW_PRIVATE_DATABASE_HOSTS=true (closes SSRF and DNS rebinding).
 * Merchants should still connect with a read-only database user.
 */

export type DatabaseSslMode = 'disable' | 'require' | 'verify-full';

/** `mysql` covers MariaDB too: same protocol and driver. */
export type DatabaseEngine = 'postgres' | 'mysql';

export const DEFAULT_PORTS: Record<DatabaseEngine, number> = { postgres: 5432, mysql: 3306 };


export interface DatabaseCredentials {
  engine: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: DatabaseSslMode;
  productsQuery: string;
  ordersQuery: string;
}

/** Everything about a connection except its password - safe to send to the browser for editing. */
export type DatabaseConfig = Omit<DatabaseCredentials, 'password'>;

export const PRODUCT_COLUMNS = {
  required: ['id', 'title', 'inventory_quantity'],
  optional: ['sku', 'price', 'product_type', 'created_at', 'updated_at'],
} as const;

/** One row per order line item; rows sharing an order_id become one order. */
export const ORDER_COLUMNS = {
  required: ['order_id', 'created_at', 'product_id', 'quantity'],
  optional: ['price', 'total_price', 'line_item_id'],
} as const;

/** Rows a single query may return before we refuse it (products, or order line items). */
export const MAX_ROWS = 100_000;
const MAX_QUERY_LENGTH = 20_000;
const CONNECT_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 30_000;

export type DatabaseErrorReason = 'invalid_input' | 'auth' | 'not_found' | 'unreachable' | 'query';

export class DatabaseConnectorError extends Error {
  constructor(readonly reason: DatabaseErrorReason, message: string) {
    super(message);
    this.name = 'DatabaseConnectorError';
  }
}

/** HTTP status the proxy answers with, chosen so src/utils/storeHealth.ts classifies it correctly. */
export function httpStatusFor(reason: DatabaseErrorReason): 400 | 401 | 404 | 422 | 502 {
  switch (reason) {
    case 'invalid_input':
      return 400;
    case 'auth':
      return 401;
    case 'not_found':
      return 404;
    case 'unreachable':
      return 502;
    case 'query':
      return 422;
  }
}

// --- Input parsing -----------------------------------------------------------

const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Accepts Postgres's sslmode values and MySQL's ssl-mode ones
 * (DISABLED, PREFERRED, REQUIRED, VERIFY_CA, VERIFY_IDENTITY).
 */
function parseSslMode(value: unknown): DatabaseSslMode | null {
  const mode = text(value).toLowerCase().replace(/_/g, '-');
  if (!mode || ['require', 'required', 'prefer', 'preferred', 'allow'].includes(mode)) return 'require';
  if (mode === 'disable' || mode === 'disabled') return 'disable';
  if (['verify-full', 'verify-ca', 'verify-identity'].includes(mode)) return 'verify-full';
  return null;
}

const SCHEMES: Record<string, DatabaseEngine> = {
  'postgres:': 'postgres',
  'postgresql:': 'postgres',
  'mysql:': 'mysql',
  'mariadb:': 'mysql',
};

/** Strips trailing semicolons/whitespace so the query can be wrapped as a subquery. */
export function normalizeQuery(raw: unknown): string {
  return text(raw).replace(/[\s;]+$/, '');
}

interface ConnectionFields {
  engine: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: DatabaseSslMode;
}

function parseConnectionString(raw: string): ConnectionFields | string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'That connection string is not a valid URL, e.g. "postgres://user:password@host:5432/dbname".';
  }
  const engine = SCHEMES[url.protocol];
  if (!engine) {
    return 'Use a PostgreSQL (postgres://…) or MySQL/MariaDB (mysql://…) connection string.';
  }
  const ssl = parseSslMode(url.searchParams.get('sslmode') ?? url.searchParams.get('ssl-mode'));
  if (!ssl) return 'Unsupported SSL mode in the connection string.';
  return {
    engine,
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: url.port ? Number(url.port) : DEFAULT_PORTS[engine],
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl,
  };
}

/**
 * Validates what the connect form sent. Returns the credentials to test and
 * save, or a message saying what to fix. `password` may come back empty -
 * the caller decides whether a previously saved one can be reused.
 */
export function parseDatabaseInput(body: Record<string, unknown>): DatabaseCredentials | string {
  let fields: ConnectionFields;
  const connectionString = text(body.connectionString);

  if (connectionString) {
    const parsed = parseConnectionString(connectionString);
    if (typeof parsed === 'string') return parsed;
    fields = parsed;
  } else {
    const engine = body.engine === undefined || body.engine === '' ? 'postgres' : body.engine;
    if (engine !== 'postgres' && engine !== 'mysql') return 'Database type must be "postgres" or "mysql".';
    const ssl = parseSslMode(body.ssl);
    if (!ssl) return 'SSL mode must be "disable", "require" or "verify-full".';
    const port = body.port === undefined || body.port === '' ? DEFAULT_PORTS[engine] : Number(body.port);
    fields = {
      engine,
      host: text(body.host),
      port,
      database: text(body.database),
      user: text(body.user),
      password: typeof body.password === 'string' ? body.password : '',
      ssl,
    };
  }

  if (!fields.host || !(isIP(fields.host) || HOSTNAME_PATTERN.test(fields.host))) {
    return 'Enter a valid database host, e.g. "db.example.com".';
  }
  if (!Number.isInteger(fields.port) || fields.port < 1 || fields.port > 65535) {
    return 'Port must be a number between 1 and 65535.';
  }
  if (!fields.database || fields.database.length > 128) return 'Enter the database name.';
  if (!fields.user || fields.user.length > 128) return 'Enter the database user.';
  if (fields.password.length > 1024) return 'That password is too long.';

  const productsQuery = normalizeQuery(body.productsQuery);
  const ordersQuery = normalizeQuery(body.ordersQuery);
  if (!productsQuery) return 'Enter a SQL query for products.';
  if (!ordersQuery) return 'Enter a SQL query for orders.';
  if (productsQuery.length > MAX_QUERY_LENGTH || ordersQuery.length > MAX_QUERY_LENGTH) {
    return `Queries must be under ${MAX_QUERY_LENGTH.toLocaleString('en-US')} characters.`;
  }

  return { ...fields, host: fields.host.toLowerCase(), productsQuery, ordersQuery };
}

export function storeIdForDatabase(credentials: Pick<DatabaseCredentials, 'host' | 'port' | 'database'>): string {
  const raw = `db-${credentials.host}-${credentials.port}-${credentials.database}`;
  return raw.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 200);
}

/** Display address for the store list - never includes the user or password. */
export function databaseUrl(credentials: Pick<DatabaseCredentials, 'engine' | 'host' | 'port' | 'database'>): string {
  const host = isIP(credentials.host) === 6 ? `[${credentials.host}]` : credentials.host;
  return `${credentials.engine}://${host}:${credentials.port}/${encodeURIComponent(credentials.database)}`;
}

export function toDatabaseConfig(credentials: DatabaseCredentials): DatabaseConfig {
  const config: Partial<DatabaseCredentials> = { ...credentials };
  delete config.password;
  return config as DatabaseConfig;
}

export function isDatabaseCredentials(value: unknown): value is DatabaseCredentials {
  const engine = typeof value === 'object' && value !== null ? (value as { engine?: unknown }).engine : undefined;
  return engine === 'postgres' || engine === 'mysql';
}

// --- Host safety -------------------------------------------------------------

export function allowPrivateHosts(): boolean {
  return process.env.ALLOW_PRIVATE_DATABASE_HOSTS === 'true';
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast and reserved
  );
}

/** True for loopback, private, link-local and other non-internet addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);

  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  const first = parseInt(lower.split(':')[0] || '0', 16);
  return (
    first === 0 || // ::, ::1, IPv4-compatible/mapped in hex form
    lower.startsWith('64:ff9b:') || // NAT64 - can map onto private IPv4
    (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xff00) === 0xff00 // multicast
  );
}

/**
 * Resolves the host once, here, and returns the IP to connect to. Checking
 * every resolved address and then dialling that same IP means a hostname
 * can't pass the check and then resolve somewhere internal (DNS rebinding).
 */
export async function resolveDatabaseHost(host: string): Promise<string> {
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map(entry => entry.address);
    } catch {
      throw new DatabaseConnectorError('unreachable', `Could not find a server called "${host}". Check the host name.`);
    }
  }

  if (addresses.length === 0) {
    throw new DatabaseConnectorError('unreachable', `Could not find a server called "${host}". Check the host name.`);
  }
  if (!allowPrivateHosts() && addresses.some(isPrivateAddress)) {
    throw new DatabaseConnectorError(
      'invalid_input',
      `${host} is a private or local address. Pithos only connects to databases reachable from the internet ` +
        '(a self-hosted deployment can allow private hosts with ALLOW_PRIVATE_DATABASE_HOSTS=true).'
    );
  }
  return addresses[0];
}

// --- Running queries ---------------------------------------------------------

export interface QueryRows {
  columns: string[];
  rows: Record<string, unknown>[];
}

const timeoutMessage = () => `The query took longer than ${STATEMENT_TIMEOUT_MS / 1000}s and was cancelled.`;

/** What every engine shares once its own error codes have been checked. */
function describeConnectionError(message: string): DatabaseConnectorError {
  if (/does not support SSL|does not support secure connection/i.test(message)) {
    return new DatabaseConnectorError('unreachable', 'This server does not accept SSL connections. Set SSL mode to "disable" if that is expected.');
  }
  if (/self[- ]signed|certificate|altnames/i.test(message)) {
    return new DatabaseConnectorError('unreachable', `SSL certificate could not be verified (${message}). Use SSL mode "require" to skip verification.`);
  }
  return new DatabaseConnectorError('unreachable', `Could not connect to the database: ${message}`);
}

/** Wraps the merchant's query as a subquery so it can be capped (and can only be a SELECT). */
function wrapQuery(sql: string, rowLimit: number): string {
  return `SELECT * FROM (\n${normalizeQuery(sql)}\n) AS pithos_source LIMIT ${rowLimit}`;
}

// PostgreSQL

function describePostgresError(err: { code?: unknown }, message: string): DatabaseConnectorError {
  const code = typeof err.code === 'string' ? err.code : '';

  if (code === '28P01' || code === '28000') {
    return new DatabaseConnectorError('auth', 'The database rejected that user name or password.');
  }
  if (code === '3D000') return new DatabaseConnectorError('not_found', `Database not found: ${message}`);
  if (code === '42501') {
    return new DatabaseConnectorError('query', `Permission denied - grant this user SELECT on the tables you query. (${message})`);
  }
  if (code === '57014') return new DatabaseConnectorError('query', timeoutMessage());
  if (/^[0-9A-Z]{5}$/.test(code) && !code.startsWith('08') && !code.startsWith('53') && !code.startsWith('57P')) {
    // Any other SQLSTATE is about the query itself (syntax, unknown column, ...).
    return new DatabaseConnectorError('query', `Query failed: ${message}`);
  }
  return describeConnectionError(message);
}

async function queryPostgres(credentials: DatabaseCredentials, address: string, sql: string, rowLimit: number): Promise<QueryRows> {
  const client = new pg.Client({
    host: address,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    // We dial an IP, so name the host for SNI and certificate checks.
    ssl:
      credentials.ssl === 'disable'
        ? false
        : { servername: isIP(credentials.host) ? undefined : credentials.host, rejectUnauthorized: credentials.ssl === 'verify-full' },
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS + 5_000,
    application_name: 'pithos',
  });
  // An idle-connection error after we're done must not crash the process.
  client.on('error', () => {});

  try {
    await client.connect();
    await client.query('BEGIN TRANSACTION READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await client.query({
      text: wrapQuery(sql, rowLimit),
      // Extended protocol: exactly one statement, so nothing can be chained after the SELECT.
      queryMode: 'extended',
    } as pg.QueryConfig);
    await client.query('ROLLBACK');
    return { columns: result.fields.map(field => field.name), rows: result.rows };
  } catch (error) {
    const err = (error ?? {}) as { code?: unknown; message?: unknown };
    throw error instanceof DatabaseConnectorError
      ? error
      : describePostgresError(err, typeof err.message === 'string' ? err.message : String(error));
  } finally {
    await client.end().catch(() => {});
  }
}

// MySQL / MariaDB

/** Server errors about the connection rather than the query (too many connections, host blocked, ...). */
const MYSQL_CONNECTION_ERRNOS = new Set([1040, 1053, 1129, 1203]);

function describeMysqlError(err: { code?: unknown; errno?: unknown; sqlState?: unknown }, message: string): DatabaseConnectorError {
  const errno = typeof err.errno === 'number' ? err.errno : 0;
  const code = typeof err.code === 'string' ? err.code : '';

  if (errno === 1045 || errno === 1044) {
    return new DatabaseConnectorError('auth', 'The database rejected that user name or password.');
  }
  if (errno === 1130) {
    return new DatabaseConnectorError('auth', `The database does not accept connections from this server's address. (${message})`);
  }
  if (errno === 1049) return new DatabaseConnectorError('not_found', `Database not found: ${message}`);
  if (errno === 1142 || errno === 1143) {
    return new DatabaseConnectorError('query', `Permission denied - grant this user SELECT on the tables you query. (${message})`);
  }
  // 3024: MySQL's MAX_EXECUTION_TIME; 1969: MariaDB's max_statement_time; the last is our own client-side timeout.
  if (errno === 3024 || errno === 1969 || code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
    return new DatabaseConnectorError('query', timeoutMessage());
  }
  // 2000-2999 are client-side errors; everything else with a SQLSTATE came from the server about the query.
  if (typeof err.sqlState === 'string' && errno && !(errno >= 2000 && errno < 3000) && !MYSQL_CONNECTION_ERRNOS.has(errno)) {
    return new DatabaseConnectorError('query', `Query failed: ${message}`);
  }
  return describeConnectionError(message);
}

function mysqlSsl(credentials: DatabaseCredentials): mysql.ConnectionOptions['ssl'] {
  if (credentials.ssl === 'disable') return undefined;
  if (credentials.ssl === 'verify-full') return { rejectUnauthorized: true, verifyIdentity: true };
  return { rejectUnauthorized: false };
}

async function queryMysql(credentials: DatabaseCredentials, address: string, sql: string, rowLimit: number): Promise<QueryRows> {
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      // `host` is only used for TLS (server name, certificate check); the
      // socket itself goes to the address we resolved and vetted.
      host: credentials.host,
      port: credentials.port,
      stream: () => netConnect(credentials.port, address),
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      ssl: mysqlSsl(credentials),
      connectTimeout: CONNECT_TIMEOUT_MS,
      // One statement per query: nothing can be chained after the SELECT.
      multipleStatements: false,
      // BIGINT ids beyond 2^53 arrive as exact strings rather than rounded numbers.
      supportBigNumbers: true,
      bigNumberStrings: true,
      // DATETIME has no time zone: read it, and TIMESTAMP (via the session
      // time_zone below), as UTC wherever this server runs.
      timezone: 'Z',
    });
    connection.on('error', () => {});

    const [versionRows] = await connection.query<mysql.RowDataPacket[]>('SELECT VERSION() AS version');
    const isMariaDb = /mariadb/i.test(String(versionRows[0]?.version ?? ''));
    await connection.query("SET time_zone = '+00:00'");
    // Server-side timeout (MySQL 5.7.8+ / MariaDB 10.1+). Older servers lack
    // the variable; the client-side timeout on the query below still applies.
    await connection
      .query(
        isMariaDb
          ? `SET SESSION max_statement_time = ${STATEMENT_TIMEOUT_MS / 1000}`
          : `SET SESSION MAX_EXECUTION_TIME = ${STATEMENT_TIMEOUT_MS}`
      )
      .catch(() => {});
    await connection.query('START TRANSACTION READ ONLY');
    const [rows, fields] = await connection.query<mysql.RowDataPacket[]>({
      sql: wrapQuery(sql, rowLimit),
      timeout: STATEMENT_TIMEOUT_MS + 5_000,
    });
    await connection.query('ROLLBACK');
    return { columns: fields.map(field => field.name), rows: rows as Record<string, unknown>[] };
  } catch (error) {
    const err = (error ?? {}) as { code?: unknown; errno?: unknown; sqlState?: unknown; message?: unknown };
    throw error instanceof DatabaseConnectorError
      ? error
      : describeMysqlError(err, typeof err.message === 'string' ? err.message : String(error));
  } finally {
    // end() waits for the server; destroy() covers a connection a timeout already broke.
    await connection?.end().catch(() => connection?.destroy());
  }
}

/**
 * Runs one SELECT read-only and returns at most `limit` rows (lower-cased
 * column names). More rows than MAX_ROWS is an error rather than a silent
 * truncation, which would quietly skew every sales figure.
 */
export async function runReadOnlyQuery(credentials: DatabaseCredentials, sql: string, limit = MAX_ROWS): Promise<QueryRows> {
  const address = await resolveDatabaseHost(credentials.host);
  const cap = Math.min(Math.max(1, Math.floor(limit)), MAX_ROWS);

  const run = credentials.engine === 'mysql' ? queryMysql : queryPostgres;
  const result = await run(credentials, address, sql, cap + 1);

  if (result.rows.length > cap) {
    if (cap === MAX_ROWS) {
      throw new DatabaseConnectorError(
        'query',
        `The query returned more than ${MAX_ROWS.toLocaleString('en-US')} rows. Narrow it down (e.g. only the last year of orders).`
      );
    }
    // A deliberately small sample (connection tests, health checks).
    result.rows.length = cap;
  }

  const columns = result.columns.map(column => column.toLowerCase());
  const rows = result.rows.map(row => {
    const lowered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) lowered[key.toLowerCase()] = value;
    return lowered;
  });
  return { columns, rows };
}

// --- Mapping rows to the dashboard's shapes ---------------------------------

export interface AdaptedProduct {
  id: number;
  title: string;
  variants: Array<{ id: number; inventory_quantity: number; price: string; sku: string }>;
  product_type: string;
  created_at: string;
  updated_at: string;
}

export interface AdaptedOrder {
  id: number;
  created_at: string;
  total_price: string;
  line_items: Array<{ id: number; product_id: number; quantity: number; price: string }>;
}

function assertColumns(kind: 'products' | 'orders', columns: string[], required: readonly string[]) {
  const missing = required.filter(column => !columns.includes(column));
  if (missing.length) {
    throw new DatabaseConnectorError(
      'query',
      `The ${kind} query is missing column${missing.length > 1 ? 's' : ''} ${missing.map(c => `"${c}"`).join(', ')}. ` +
        `Rename columns with AS, e.g. "SELECT name AS title".`
    );
  }
}

/** 53-bit string hash (cyrb53): stable, so the same key always maps to the same id. */
function hash53(value: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * The dashboard keys products by numeric id. Integer ids pass through;
 * anything else (UUIDs, codes) becomes a stable hash, applied identically to
 * products.id and order lines' product_id so they still match up.
 */
export function toNumericId(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  const raw = value instanceof Date ? value.toISOString() : String(value ?? '').trim();
  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n)) return n;
  }
  return hash53(raw);
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toPrice(value: unknown): string {
  if (value === null || value === undefined || value === '') return '0';
  return String(toNumber(value));
}

function toIsoDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

const asText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

export function mapProducts({ columns, rows }: QueryRows): AdaptedProduct[] {
  assertColumns('products', columns, PRODUCT_COLUMNS.required);
  return rows.map(row => {
    const id = toNumericId(row.id);
    return {
      id,
      title: asText(row.title) || 'Untitled product',
      variants: [
        {
          id,
          inventory_quantity: Math.trunc(toNumber(row.inventory_quantity)),
          price: toPrice(row.price),
          sku: asText(row.sku) || asText(row.id),
        },
      ],
      product_type: asText(row.product_type) || 'Uncategorized',
      created_at: toIsoDate(row.created_at),
      updated_at: toIsoDate(row.updated_at),
    };
  });
}

export function mapOrders({ columns, rows }: QueryRows): AdaptedOrder[] {
  assertColumns('orders', columns, ORDER_COLUMNS.required);

  const orders = new Map<string, AdaptedOrder & { declaredTotal: string | null }>();
  rows.forEach(row => {
    const key = asText(row.order_id);
    const createdAt = toIsoDate(row.created_at);
    if (!createdAt) {
      throw new DatabaseConnectorError('query', `Order ${key} has an invalid created_at value: ${asText(row.created_at) || 'empty'}.`);
    }

    let order = orders.get(key);
    if (!order) {
      const declared = row.total_price;
      order = {
        id: toNumericId(row.order_id),
        created_at: createdAt,
        total_price: '0',
        declaredTotal: declared === null || declared === undefined || declared === '' ? null : toPrice(declared),
        line_items: [],
      };
      orders.set(key, order);
    }

    order.line_items.push({
      id: row.line_item_id !== undefined && row.line_item_id !== null
        ? toNumericId(row.line_item_id)
        : hash53(`${key}:${order.line_items.length}`),
      product_id: toNumericId(row.product_id),
      quantity: Math.trunc(toNumber(row.quantity)),
      price: toPrice(row.price),
    });
  });

  return [...orders.values()].map(({ declaredTotal, ...order }) => ({
    ...order,
    total_price:
      declaredTotal ??
      String(Math.round(order.line_items.reduce((sum, item) => sum + item.quantity * Number(item.price), 0) * 100) / 100),
  }));
}

export async function fetchProducts(credentials: DatabaseCredentials, limit?: number): Promise<AdaptedProduct[]> {
  return mapProducts(await runReadOnlyQuery(credentials, credentials.productsQuery, limit));
}

export async function fetchOrders(credentials: DatabaseCredentials, limit?: number): Promise<AdaptedOrder[]> {
  return mapOrders(await runReadOnlyQuery(credentials, credentials.ordersQuery, limit));
}

/** Proves the connection and both queries work (and have the right columns) before anything is saved. */
export async function testDatabaseConnection(credentials: DatabaseCredentials): Promise<{ products: number; orders: number }> {
  const products = await fetchProducts(credentials, 5);
  const orders = await fetchOrders(credentials, 5);
  return { products: products.length, orders: orders.length };
}
