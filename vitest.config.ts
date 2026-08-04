import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

// 测试时内部包直接解析到 TS 源码，避免依赖 dist 构建产物。
const workspaceAliases = [
  'contracts',
  'domain',
  'application',
  'database',
  'ai-core',
].map((name) => ({
  find: new RegExp(`^@today-dont-push/${name}$`),
  replacement: `${root}packages/${name}/src/index.ts`,
}));

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: 'node',
    include: ['apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
});
