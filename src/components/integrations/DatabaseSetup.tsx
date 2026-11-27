import React, { useEffect, useState } from 'react';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import {
  connectDatabase,
  getDatabaseConfig,
  type DatabaseConnectionInput,
  type DatabaseEngine,
  type DatabaseSslMode,
} from '../../services/api';

/**
 * Starting points for the two queries. Column names on the left of each AS
 * are guesses at a typical schema; the aliases are what Pithos reads - see
 * PRODUCT_COLUMNS / ORDER_COLUMNS in server/lib/customDatabase.ts.
 */
const DEFAULT_PRODUCTS_QUERY = `SELECT
  p.id,
  p.name        AS title,
  p.sku,
  p.price,
  p.stock       AS inventory_quantity,
  p.category    AS product_type,
  p.created_at,
  p.updated_at
FROM products p`;

const ordersQuery = (lastYear: string) => `SELECT
  o.id          AS order_id,
  o.created_at,
  oi.product_id,
  oi.quantity,
  oi.unit_price AS price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at >= ${lastYear}`;

/** Everything on the form that differs between engines. */
const ENGINES: Record<
  DatabaseEngine,
  { label: string; port: string; ordersQuery: string; example: string; noSslParam: string }
> = {
  postgres: {
    label: 'PostgreSQL',
    port: '5432',
    ordersQuery: ordersQuery("now() - interval '1 year'"),
    example: 'postgres://user:password@db.example.com:5432/shop',
    noSslParam: '?sslmode=disable',
  },
  mysql: {
    label: 'MySQL / MariaDB',
    port: '3306',
    ordersQuery: ordersQuery('NOW() - INTERVAL 1 YEAR'),
    example: 'mysql://user:password@db.example.com:3306/shop',
    noSslParam: '?ssl-mode=DISABLED',
  },
};

const inputClass =
  'px-3.5 py-[11px] rounded-[9px] border border-white/[0.09] bg-white/[0.03] text-[13px] font-mono-ibm text-white placeholder-white/30 outline-none focus:border-accent/60';

type ConnectionMode = 'url' | 'fields';

interface DatabaseSetupProps {
  onClose: () => void;
  /** Renders just the card content, no backdrop/close button - used inline in the onboarding wizard. */
  standalone?: boolean;
  /** Success redirects to /dashboard?onboarding=1 so DashboardPage shows the first-sync screen. */
  isOnboarding?: boolean;
  /** Shown as a link to connect a store platform instead - only passed by the onboarding wizard. */
  onSwitchPlatform?: () => void;
  /** Edit this saved connection instead of adding a new one. */
  editStoreId?: string;
  editStoreName?: string;
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-medium text-white/60">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-relaxed text-white/35">{hint}</span>}
    </label>
  );
}

const Columns = ({ names }: { names: string[] }) => (
  <>
    {names.map((name, i) => (
      <React.Fragment key={name}>
        {i > 0 && ', '}
        <code className="font-mono-ibm text-white/55">{name}</code>
      </React.Fragment>
    ))}
  </>
);

export function DatabaseSetup({
  onClose,
  standalone = false,
  isOnboarding = false,
  onSwitchPlatform,
  editStoreId,
  editStoreName,
}: DatabaseSetupProps) {
  useLockBodyScroll(!standalone);
  const { user } = useAuth();
  const isEditing = Boolean(editStoreId);

  const [engine, setEngine] = useState<DatabaseEngine>('postgres');
  const [mode, setMode] = useState<ConnectionMode>(isEditing ? 'fields' : 'url');
  const [name, setName] = useState(editStoreName ?? '');
  const [connectionString, setConnectionString] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState<DatabaseSslMode>('require');
  const [productsQuery, setProductsQuery] = useState(DEFAULT_PRODUCTS_QUERY);
  const [ordersQuery, setOrdersQuery] = useState(ENGINES.postgres.ordersQuery);

  const [loadingConfig, setLoadingConfig] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Editing: pre-fill everything the server will share (all but the password).
  useEffect(() => {
    if (!editStoreId) return;
    let cancelled = false;
    getDatabaseConfig(editStoreId)
      .then(config => {
        if (cancelled) return;
        setEngine(config.engine);
        setHost(config.host);
        setPort(String(config.port));
        setDatabase(config.database);
        setDbUser(config.user);
        setSsl(config.ssl);
        setProductsQuery(config.productsQuery);
        setOrdersQuery(config.ordersQuery);
      })
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : 'Could not load this connection'))
      .finally(() => !cancelled && setLoadingConfig(false));
    return () => {
      cancelled = true;
    };
  }, [editStoreId]);

  /** Switching engine swaps in that engine's defaults - but never overwrites what the user typed. */
  const changeEngine = (next: DatabaseEngine) => {
    const previous = ENGINES[engine];
    if (port === previous.port) setPort(ENGINES[next].port);
    if (ordersQuery === previous.ordersQuery) setOrdersQuery(ENGINES[next].ordersQuery);
    setEngine(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to connect a database');
      return;
    }

    const input: DatabaseConnectionInput = {
      storeId: editStoreId,
      name: name.trim() || undefined,
      productsQuery,
      ordersQuery,
      ...(mode === 'url'
        ? { connectionString: connectionString.trim() }
        : {
            engine,
            host: host.trim(),
            port: Number(port) || Number(ENGINES[engine].port),
            database: database.trim(),
            user: dbUser.trim(),
            password,
            ssl,
          }),
    };

    setSubmitting(true);
    setError(null);
    try {
      // The server connects and runs both queries before saving anything;
      // the connection details are stored encrypted and never sent back.
      await connectDatabase(input);
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        window.location.href = isOnboarding ? '/dashboard?onboarding=1' : '/dashboard';
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect the database');
    } finally {
      setSubmitting(false);
    }
  };

  const card = (
    <div
      className={`relative w-full text-white font-archivo ${
        standalone ? '' : 'max-w-[560px] max-h-[90vh] overflow-y-auto p-8 sm:p-10 rounded-2xl bg-canvas-2 border border-white/[0.07]'
      }`}
    >
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas-2 rounded-2xl z-10">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-band-green/10 rounded-full">
                <CheckCircle className="w-8 h-8 text-band-green" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1.5">{isEditing ? 'Connection updated!' : 'Database connected!'}</h3>
            <p className="text-white/45 text-sm">Both queries ran successfully.</p>
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
          <h2 className="text-[22px] font-semibold tracking-tight text-white mb-2">
            {isEditing ? 'Edit database connection' : 'Connect your own database'}
          </h2>
          <p className="text-[12.5px] leading-relaxed text-white/45">
            Pithos reads your products and sales with two SQL queries. PostgreSQL, MySQL or MariaDB.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[11.5px] leading-relaxed text-white/50">
        <ShieldCheck className="w-4 h-4 text-accent-soft shrink-0 mt-[1px]" />
        <span>
          Queries run in a read-only transaction with a 30s timeout. Even so, connect with a database user that can only{' '}
          <code className="font-mono-ibm text-white/60">SELECT</code> the tables you need.
        </span>
      </div>

      {error && (
        <div className="mt-[18px] p-3 rounded-lg bg-band-red/10 border border-band-red/20 text-band-red text-sm whitespace-pre-wrap">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-[18px] flex flex-col gap-3.5">
        <Field label="Name (optional)">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Warehouse DB"
            maxLength={80}
            className={inputClass}
          />
        </Field>

        <Field label="Database type">
          <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-[10px] p-[3px]">
            {(Object.keys(ENGINES) as DatabaseEngine[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => changeEngine(option)}
                aria-pressed={engine === option}
                className={`flex-1 py-2 rounded-[8px] font-semibold text-xs transition-colors ${
                  engine === option ? 'bg-white/10 text-white' : 'bg-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {ENGINES[option].label}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-[10px] p-[3px]">
          {(['url', 'fields'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`flex-1 py-2 rounded-[8px] font-semibold text-xs transition-colors ${
                mode === option ? 'bg-white/10 text-white' : 'bg-transparent text-white/50 hover:text-white/80'
              }`}
            >
              {option === 'url' ? 'Connection string' : 'Host & credentials'}
            </button>
          ))}
        </div>

        {mode === 'url' ? (
          <Field
            label="Connection string"
            hint={<>Add <code className="font-mono-ibm">{ENGINES[engine].noSslParam}</code> if your server has no SSL.</>}
          >
            <input
              type="password"
              value={connectionString}
              onChange={e => setConnectionString(e.target.value)}
              placeholder={ENGINES[engine].example}
              autoComplete="off"
              className={inputClass}
              required
            />
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label="Host">
                <input type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="db.example.com" className={inputClass} required />
              </Field>
              <Field label="Port">
                <input type="number" value={port} onChange={e => setPort(e.target.value)} min={1} max={65535} className={inputClass} />
              </Field>
            </div>
            <Field label="Database">
              <input type="text" value={database} onChange={e => setDatabase(e.target.value)} placeholder="shop" className={inputClass} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="User">
                <input type="text" value={dbUser} onChange={e => setDbUser(e.target.value)} placeholder="pithos_readonly" autoComplete="off" className={inputClass} required />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isEditing ? 'Unchanged' : ''}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="SSL">
              <select value={ssl} onChange={e => setSsl(e.target.value as DatabaseSslMode)} className={inputClass}>
                <option value="require">Require (encrypted, certificate not verified)</option>
                <option value="verify-full">Verify (encrypted, certificate must be valid)</option>
                <option value="disable">Disable (no encryption)</option>
              </select>
            </Field>
          </>
        )}

        <Field
          label="Products query"
          hint={
            <>
              One row per product. Required: <Columns names={['id', 'title', 'inventory_quantity']} />. Optional:{' '}
              <Columns names={['sku', 'price', 'product_type', 'created_at', 'updated_at']} />.
            </>
          }
        >
          <textarea
            value={productsQuery}
            onChange={e => setProductsQuery(e.target.value)}
            rows={9}
            spellCheck={false}
            className={`${inputClass} resize-y leading-relaxed`}
            required
          />
        </Field>

        <Field
          label="Orders query"
          hint={
            <>
              One row per order line. Required: <Columns names={['order_id', 'created_at', 'product_id', 'quantity']} />. Optional:{' '}
              <Columns names={['price', 'total_price', 'line_item_id']} />. <code className="font-mono-ibm">product_id</code> must
              match the products query's <code className="font-mono-ibm">id</code>.
            </>
          }
        >
          <textarea
            value={ordersQuery}
            onChange={e => setOrdersQuery(e.target.value)}
            rows={9}
            spellCheck={false}
            className={`${inputClass} resize-y leading-relaxed`}
            required
          />
        </Field>

        <button
          type="submit"
          disabled={submitting || loadingConfig}
          className="py-3 rounded-[9px] bg-accent hover:bg-accent-hover text-canvas font-semibold text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingConfig ? 'Loading…' : submitting ? 'Testing queries…' : isEditing ? 'Test & save' : 'Test & connect'}
        </button>
      </form>

      {onSwitchPlatform && (
        <div className="mt-[22px] pt-[18px] border-t border-white/[0.07] flex flex-col gap-2">
          <span className="font-mono-ibm text-[11px] tracking-wide text-white/35">OR A STORE PLATFORM</span>
          <button
            type="button"
            onClick={onSwitchPlatform}
            className="flex items-center justify-between px-3.5 py-3 rounded-[10px] border border-white/10 text-white text-[12.5px] font-medium hover:border-accent/50 transition-colors"
          >
            <span>Connect a Shopify or WooCommerce store</span>
            <span className="text-white/40">→</span>
          </button>
        </div>
      )}
    </div>
  );

  if (standalone) return card;

  return <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">{card}</div>;
}
