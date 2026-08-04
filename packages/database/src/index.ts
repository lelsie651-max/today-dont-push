import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  /** 底层 postgres.js 连接，进程退出前调用 client.end()。 */
  client: ReturnType<typeof postgres>;
}

/**
 * 创建 Drizzle 数据库连接（本轮仅预留结构，没有任何业务表）。
 * 依赖约束：本包不含业务逻辑，也不依赖 domain（见 docs/architecture/overview.md）。
 */
export function createDatabase(databaseUrl: string): DatabaseConnection {
  const client = postgres(databaseUrl, { max: 1 });
  return { db: drizzle(client, { schema }), client };
}

export { schema };
