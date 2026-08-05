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

workspaceAliases.push({
  find: /^@dev\/scene-editor-entry$/,
  replacement: `${root}apps/web/src/dev/scene-editor-entry.dev.tsx`,
});

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    include: [
      'apps/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.tsx',
      'packages/*/src/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    projects: [
      {
        resolve: {
          alias: workspaceAliases,
        },
        test: {
          name: 'web',
          include: ['apps/web/src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['apps/web/src/test/setup.ts'],
        },
      },
      {
        resolve: {
          alias: workspaceAliases,
        },
        test: {
          name: 'node',
          include: [
            'apps/*/src/**/*.test.ts',
            'packages/*/src/**/*.test.ts',
            'tests/**/*.test.ts',
          ],
          exclude: ['apps/web/src/**/*.test.tsx'],
          environment: 'node',
        },
      },
    ],
  },
});
