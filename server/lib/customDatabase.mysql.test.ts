// @vitest-environment node
/**
 * The own-database connector against real MySQL and MariaDB servers: reads,
 * id/date handling, and above all the read-only guarantees. Each engine runs
 * only when its URL is set (CI sets both; locally, e.g.
 * TEST_MYSQL_URL=mysql://root:pithos@127.0.0.1:3306/pithos_test). The URL's
 * user needs to create tables and a function in that database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import {
  fetchOrders,
  fetchProducts,
  parseDatabaseInput,
  runReadOnlyQuery,
  toNumericId,
  type DatabaseCredentials,
} from './customDatabase';

const PRODUCTS_QUERY = 'SELECT id, name AS title, sku, price, stock AS inventory_quantity FROM byo_products';
const ORDERS_QUERY = `SELECT o.ref AS order_id, o.placed_at AS created_at, i.product_id, i.qty AS quantity, i.unit_price AS price
FROM byo_orders o JOIN byo_order_items i ON i.order_ref = o.ref`;

/** Larger than 2^53: only survives as an exact string. */
const BIG_ID = '9007199254740993';

const ENGINES = [
  { name: 'MySQL', url: process.env.TEST_MYSQL_URL, timeoutVariable: '@@SESSION.max_execution_time', expectedTimeout: '30000' },
  { name: 'MariaDB', url: process.env.TEST_MARIADB_URL, timeoutVariable: '@@SESSION.max_statement_time', expectedTimeout: '30' },
];

for (const engine of ENGINES) {
  describe.skipIf(!engine.url)(`own database: ${engine.name}`, () => {
    let credentials: DatabaseCredentials;
    let admin: mysql.Connection;
    const previousAllowPrivate = process.env.ALLOW_PRIVATE_DATABASE_HOSTS;

    beforeAll(async () => {
      process.env.ALLOW_PRIVATE_DATABASE_HOSTS = 'true'; // the test server is local
      const parsed = parseDatabaseInput({ connectionString: engine.url, productsQuery: PRODUCTS_QUERY, ordersQuery: ORDERS_QUERY });
      if (typeof parsed === 'string') throw new Error(parsed);
      credentials = parsed;

      admin = await mysql.createConnection({
        host: credentials.host,
        port: credentials.port,
        user: credentials.user,
        password: credentials.password,
        database: credentials.database,
        ssl: credentials.ssl === 'disable' ? undefined : { rejectUnauthorized: false },
        multipleStatements: true,
      });
      await admin.query(`
        DROP FUNCTION IF EXISTS byo_write;
        DROP TABLE IF EXISTS byo_order_items, byo_orders, byo_products, byo_side_effects;
        CREATE TABLE byo_products (id BIGINT UNSIGNED PRIMARY KEY, name VARCHAR(100), sku VARCHAR(40), price DECIMAL(10,2), stock INT);
        CREATE TABLE byo_orders (ref VARCHAR(20) PRIMARY KEY, placed_at DATETIME);
        CREATE TABLE byo_order_items (order_ref VARCHAR(20), product_id BIGINT UNSIGNED, qty INT, unit_price DECIMAL(10,2));
        CREATE TABLE byo_side_effects (n INT);
        INSERT INTO byo_products VALUES (${BIG_ID}, 'Mug', 'MUG-1', 9.50, 12), (7, 'T-shirt', 'TEE-1', 20.00, 0);
        INSERT INTO byo_orders VALUES ('A-1', '2026-03-01 10:00:00'), ('A-2', '2026-03-02 09:30:00');
        INSERT INTO byo_order_items VALUES ('A-1', ${BIG_ID}, 2, 9.50), ('A-1', 7, 1, 20.00), ('A-2', ${BIG_ID}, 1, 9.50);
        -- A "SELECT" that writes: what a read-only transaction has to stop.
        CREATE FUNCTION byo_write() RETURNS INT DETERMINISTIC MODIFIES SQL DATA
        BEGIN
          INSERT INTO byo_side_effects VALUES (1);
          RETURN 1;
        END;
      `);
    });

    afterAll(async () => {
      if (previousAllowPrivate === undefined) delete process.env.ALLOW_PRIVATE_DATABASE_HOSTS;
      else process.env.ALLOW_PRIVATE_DATABASE_HOSTS = previousAllowPrivate;
      await admin?.end();
    });

    it('reads products and orders, keeping huge ids exact and DATETIME as UTC', async () => {
      const products = await fetchProducts(credentials);
      expect(products).toHaveLength(2);
      const mug = products.find(p => p.title === 'Mug')!;
      expect(mug.id).toBe(toNumericId(BIG_ID));
      expect(mug.variants[0]).toMatchObject({ sku: 'MUG-1', price: '9.5', inventory_quantity: 12 });

      const orders = await fetchOrders(credentials);
      const a1 = orders.find(o => o.line_items.length === 2)!;
      expect(a1).toMatchObject({ id: toNumericId('A-1'), created_at: '2026-03-01T10:00:00.000Z', total_price: '39' });
      // Sales line up with the product they belong to.
      expect(a1.line_items.map(item => item.product_id)).toContain(mug.id);
    });

    it('sets a server-side statement timeout', async () => {
      const { rows } = await runReadOnlyQuery(credentials, `SELECT ${engine.timeoutVariable} AS t`);
      expect(String(Number(rows[0].t))).toBe(engine.expectedTimeout);
    });

    it('refuses writes, even for a user that is allowed to make them', async () => {
      await expect(runReadOnlyQuery(credentials, 'SELECT byo_write() AS id')).rejects.toMatchObject({ reason: 'query' });
      const [rows] = await admin.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS n FROM byo_side_effects');
      expect(Number(rows[0].n)).toBe(0);
    });

    it('refuses to run a second statement chained after the query', async () => {
      await expect(
        runReadOnlyQuery(credentials, 'SELECT 1 AS id) x; DROP TABLE byo_products; SELECT * FROM (SELECT 1 AS id')
      ).rejects.toMatchObject({ reason: 'query' });
      const [rows] = await admin.query<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'byo_products'");
      expect(rows).toHaveLength(1);
    });

    it('caps a sample to the requested number of rows', async () => {
      expect(await fetchProducts(credentials, 1)).toHaveLength(1);
    });

    it('explains what went wrong', async () => {
      await expect(fetchProducts({ ...credentials, productsQuery: 'SELECT id, name FROM byo_products' })).rejects.toThrow(
        /missing columns "title", "inventory_quantity"/
      );
      await expect(fetchProducts({ ...credentials, productsQuery: 'SELECT * FROM nope' })).rejects.toMatchObject({ reason: 'query' });
      await expect(fetchProducts({ ...credentials, password: 'wrong-password' })).rejects.toMatchObject({ reason: 'auth' });
      await expect(fetchProducts({ ...credentials, database: 'no_such_db' })).rejects.toMatchObject({ reason: 'not_found' });
    });
  });
}
