// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import {
  DatabaseConnectorError,
  databaseUrl,
  isPrivateAddress,
  mapOrders,
  mapProducts,
  parseDatabaseInput,
  resolveDatabaseHost,
  storeIdForDatabase,
  toDatabaseConfig,
  toNumericId,
} from './customDatabase';

const QUERIES = { productsQuery: 'SELECT 1 AS id;  ', ordersQuery: 'SELECT 1 AS order_id' };

describe('parseDatabaseInput', () => {
  it('parses a connection string, including encoded credentials and sslmode', () => {
    const parsed = parseDatabaseInput({
      connectionString: 'postgresql://read%40only:p%2Fss@DB.Example.com:6543/shop?sslmode=verify-full',
      ...QUERIES,
    });
    expect(parsed).toEqual({
      engine: 'postgres',
      host: 'db.example.com',
      port: 6543,
      database: 'shop',
      user: 'read@only',
      password: 'p/ss',
      ssl: 'verify-full',
      productsQuery: 'SELECT 1 AS id',
      ordersQuery: 'SELECT 1 AS order_id',
    });
  });

  it('accepts individual fields with sensible defaults', () => {
    const parsed = parseDatabaseInput({ host: 'db.example.com', database: 'shop', user: 'ro', password: 'x', ...QUERIES });
    expect(parsed).toMatchObject({ port: 5432, ssl: 'require' });
  });

  it.each([
    [{ connectionString: 'mongodb://u:p@h/db' }, /PostgreSQL .* or MySQL/],
    [{ connectionString: 'mysql://u:p@db.example.com/shop?ssl-mode=sometimes' }, /SSL mode/],
    [{ engine: 'oracle', host: 'db.example.com', database: 'd', user: 'u' }, /Database type/],
    [{ host: 'bad host!', database: 'd', user: 'u' }, /host/],
    [{ host: 'db.example.com', port: 70000, database: 'd', user: 'u' }, /Port/],
    [{ host: 'db.example.com', database: '', user: 'u' }, /database name/],
    [{ host: 'db.example.com', database: 'd', user: 'u', ssl: 'sometimes' }, /SSL/],
  ])('rejects %o', (fields, message) => {
    expect(parseDatabaseInput({ ...fields, ...QUERIES })).toMatch(message);
  });

  it('parses MySQL and MariaDB connection strings, including MySQL-style ssl-mode', () => {
    expect(parseDatabaseInput({ connectionString: 'mysql://ro:pw@db.example.com/shop?ssl-mode=VERIFY_IDENTITY', ...QUERIES })).toMatchObject({
      engine: 'mysql',
      port: 3306,
      ssl: 'verify-full',
    });
    expect(parseDatabaseInput({ connectionString: 'mariadb://ro:pw@db.example.com:3307/shop?ssl-mode=DISABLED', ...QUERIES })).toMatchObject({
      engine: 'mysql',
      port: 3307,
      ssl: 'disable',
    });
    expect(parseDatabaseInput({ connectionString: 'mysql://ro:pw@db.example.com/shop?ssl-mode=REQUIRED', ...QUERIES })).toMatchObject({
      ssl: 'require',
    });
  });

  it('defaults the port by engine when connecting with fields', () => {
    expect(parseDatabaseInput({ engine: 'mysql', host: 'db.example.com', database: 'd', user: 'u', ...QUERIES })).toMatchObject({
      engine: 'mysql',
      port: 3306,
    });
    expect(parseDatabaseInput({ host: 'db.example.com', database: 'd', user: 'u', ...QUERIES })).toMatchObject({
      engine: 'postgres',
      port: 5432,
    });
  });

  it('requires both queries', () => {
    expect(parseDatabaseInput({ host: 'db.example.com', database: 'd', user: 'u', productsQuery: ' ; ', ordersQuery: 'x' })).toMatch(/products/);
  });
});

describe('store identity', () => {
  const creds = { engine: 'postgres' as const, host: 'db.example.com', port: 5432, database: 'my shop' };

  it('derives a stable id and a display URL without credentials', () => {
    expect(storeIdForDatabase(creds)).toBe('db-db-example-com-5432-my-shop');
    expect(databaseUrl(creds)).toBe('postgres://db.example.com:5432/my%20shop');
    expect(databaseUrl({ ...creds, engine: 'mysql', port: 3306 })).toBe('mysql://db.example.com:3306/my%20shop');
  });

  it('never exposes the password in the editable config', () => {
    const parsed = parseDatabaseInput({ host: 'db.example.com', database: 'd', user: 'u', password: 'secret', ...QUERIES });
    if (typeof parsed === 'string') throw new Error(parsed);
    expect(toDatabaseConfig(parsed)).not.toHaveProperty('password');
  });
});

describe('host safety', () => {
  afterEach(() => {
    delete process.env.ALLOW_PRIVATE_DATABASE_HOSTS;
  });

  it.each(['127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])(
    'treats %s as private',
    ip => expect(isPrivateAddress(ip)).toBe(true)
  );

  it.each(['8.8.8.8', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8'])('treats %s as public', ip => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it('refuses private hosts unless the operator allows them', async () => {
    await expect(resolveDatabaseHost('127.0.0.1')).rejects.toMatchObject({ reason: 'invalid_input' });
    process.env.ALLOW_PRIVATE_DATABASE_HOSTS = 'true';
    await expect(resolveDatabaseHost('127.0.0.1')).resolves.toBe('127.0.0.1');
  });

  it('resolves names and checks the resulting address', async () => {
    await expect(resolveDatabaseHost('localhost')).rejects.toMatchObject({ reason: 'invalid_input' });
  });
});

describe('toNumericId', () => {
  it('passes integers through and hashes everything else stably', () => {
    expect(toNumericId(42)).toBe(42);
    expect(toNumericId('42')).toBe(42);
    const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    expect(toNumericId(uuid)).toBe(toNumericId(uuid));
    expect(Number.isSafeInteger(toNumericId(uuid))).toBe(true);
    expect(toNumericId(uuid)).not.toBe(toNumericId('another-id'));
    expect(toNumericId('99999999999999999999')).toBe(toNumericId('99999999999999999999'));
  });
});

describe('mapProducts', () => {
  it('adapts rows into the dashboard product shape', () => {
    const [product] = mapProducts({
      columns: ['id', 'title', 'inventory_quantity', 'price', 'sku', 'product_type', 'created_at'],
      rows: [{ id: 'abc', title: 'Mug', inventory_quantity: '7', price: '12.50', sku: 'MUG-1', product_type: null, created_at: new Date('2026-01-02T00:00:00Z') }],
    });
    expect(product).toEqual({
      id: toNumericId('abc'),
      title: 'Mug',
      variants: [{ id: toNumericId('abc'), inventory_quantity: 7, price: '12.5', sku: 'MUG-1' }],
      product_type: 'Uncategorized',
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: '',
    });
  });

  it('names the missing columns', () => {
    expect(() => mapProducts({ columns: ['id', 'name'], rows: [] })).toThrow(/"title", "inventory_quantity"/);
    try {
      mapProducts({ columns: ['id'], rows: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseConnectorError);
      expect((error as DatabaseConnectorError).reason).toBe('query');
    }
  });
});

describe('mapOrders', () => {
  const columns = ['order_id', 'created_at', 'product_id', 'quantity', 'price'];

  it('groups line rows into orders and totals them', () => {
    const orders = mapOrders({
      columns,
      rows: [
        { order_id: 1, created_at: '2026-03-01T10:00:00Z', product_id: 'abc', quantity: 2, price: '5.25' },
        { order_id: 1, created_at: '2026-03-01T10:00:00Z', product_id: 9, quantity: 1, price: 10 },
        { order_id: 2, created_at: '2026-03-02T10:00:00Z', product_id: 9, quantity: 3, price: null },
      ],
    });
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({ id: 1, total_price: '20.5', created_at: '2026-03-01T10:00:00.000Z' });
    expect(orders[0].line_items.map(item => item.product_id)).toEqual([toNumericId('abc'), 9]);
    expect(new Set(orders[0].line_items.map(item => item.id)).size).toBe(2);
    expect(orders[1]).toMatchObject({ total_price: '0' });
  });

  it('prefers a declared total_price', () => {
    const [order] = mapOrders({
      columns: [...columns, 'total_price'],
      rows: [{ order_id: 'A-1', created_at: '2026-03-01', product_id: 1, quantity: 1, price: 5, total_price: '7.99' }],
    });
    expect(order.total_price).toBe('7.99');
  });

  it('rejects rows without a usable date', () => {
    expect(() => mapOrders({ columns, rows: [{ order_id: 1, created_at: 'soon', product_id: 1, quantity: 1 }] })).toThrow(/created_at/);
  });
});
