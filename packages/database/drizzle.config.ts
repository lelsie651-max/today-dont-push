import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit 配置（结构预留）。
 * 本轮没有任何业务表，generate/migrate 暂不产生迁移。
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/today_dont_push',
  },
});
