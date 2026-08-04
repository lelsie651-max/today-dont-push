/**
 * dependency-cruiser 依赖边界配置。
 * 规则与 docs/architecture/overview.md 中的分层一一对应，
 * 由根命令 `pnpm architecture:check` 强制执行。
 * 内部包通过 tsconfig.depcruise.json 的 paths 解析到 TS 源码，
 * 保证未构建 dist 时也能检查。
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: '禁止循环依赖',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-not-to-apps',
      comment: 'packages 永远不得依赖 apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'contracts-no-internal-deps',
      comment: 'contracts 不得依赖任何内部包（只允许 zod 等第三方）',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { path: '^(apps|packages)/', pathNot: ['^packages/contracts/'] },
    },
    {
      name: 'domain-no-internal-deps',
      comment: 'domain 不得依赖任何内部包',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: { path: '^(apps|packages)/', pathNot: ['^packages/domain/'] },
    },
    {
      name: 'domain-no-frameworks',
      comment: 'domain 不得依赖任何框架或第三方库',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: { path: 'node_modules' },
    },
    {
      name: 'application-only-domain',
      comment: 'application 只允许依赖 domain',
      severity: 'error',
      from: { path: '^packages/application/' },
      to: {
        path: '^(apps|packages)/',
        pathNot: ['^packages/application/', '^packages/domain/'],
      },
    },
    {
      name: 'infra-adapters-direction',
      comment:
        'database/ai-core 属于基础设施适配器，内部依赖只允许 application/domain',
      severity: 'error',
      from: { path: '^packages/(database|ai-core)/' },
      to: {
        path: '^(apps|packages)/',
        pathNot: [
          '^packages/database/',
          '^packages/ai-core/',
          '^packages/application/',
          '^packages/domain/',
        ],
      },
    },
    {
      name: 'web-only-contracts',
      comment: 'web 只允许依赖 contracts，禁止依赖 database/domain/ai-core/application',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: {
        path: '^(apps|packages)/',
        pathNot: ['^apps/web/', '^packages/contracts/'],
      },
    },
    {
      name: 'api-composition-only',
      comment:
        'api 只允许组合 contracts/application/database/ai-core，不得直接依赖 domain 或其他 app',
      severity: 'error',
      from: { path: '^apps/api/' },
      to: {
        path: '^(apps|packages)/',
        pathNot: ['^apps/api/', '^packages/(contracts|application|database|ai-core)/'],
      },
    },
    {
      name: 'no-unresolvable',
      comment: '所有模块必须可解析（配置错误会在此暴露）',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    exclude: {
      path: '(^|/)(dist|node_modules|coverage)/|\\.test\\.ts$|\\.css$',
    },
  },
};
