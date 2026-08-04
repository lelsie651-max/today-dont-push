/**
 * 架构规则回归验证。
 *
 * 通过 dependency-cruiser 编程 API 扫描 tests/architecture/fixtures 下的
 * 违规模拟文件，自动断言：违规依赖被规则拒绝、合法依赖通过。
 * fixture 均为孤立的 .ts 文件（经 tsconfig.depcruise.json paths 解析到包源码），
 * 不被任何真实源码引用，也不参与 lint/typecheck。
 *
 * 调用方式与 dependency-cruiser CLI 保持一致：
 * tsConfig 需经 config-utl/extract-ts-config 解析后作为 transpile 选项传入，
 * 否则 paths 映射不生效。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import type {
  IFlattenedRuleSet,
  IForbiddenRuleType,
  IOptions,
  IViolation,
} from 'dependency-cruiser';
import { beforeAll, describe, expect, it } from 'vitest';

const nodeRequire = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE_DIR = 'tests/architecture/fixtures';
const DEPCRUISE_TSCONFIG = path.join(rootDir, 'tsconfig.depcruise.json');

interface DepcruiseFileConfig {
  forbidden?: IForbiddenRuleType[];
  options?: IOptions;
}

const baseConfig = nodeRequire(
  path.join(rootDir, '.dependency-cruiser.cjs'),
) as DepcruiseFileConfig;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let parsedTsConfig: any;
beforeAll(() => {
  parsedTsConfig = extractTSConfig(DEPCRUISE_TSCONFIG);
});

/**
 * 复用根配置的全部规则；对目标规则重写 from.path 指向 fixture 目录，
 * 使隔离的 fixture 文件能命中与真实包同名的规则。
 */
function buildForbiddenRules(targetRule: string | null): IForbiddenRuleType[] {
  return (baseConfig.forbidden ?? []).map((rule) => {
    const name = (rule as { name?: string }).name;
    const from = (rule as { from?: { path?: string } }).from;
    return targetRule !== null && name === targetRule && from
      ? ({ ...rule, from: { ...from, path: `^${FIXTURE_DIR}/` } } as IForbiddenRuleType)
      : rule;
  });
}

async function cruiseFixture(fixture: string, targetRule: string | null): Promise<IViolation[]> {
  // 运行时 ruleSet 支持携带 options（CLI 即从 ruleSet.options.tsConfig.fileName 读取），
  // 但 IFlattenedRuleSet 类型定义未包含该字段，故此处局部断言。
  const ruleSet = {
    forbidden: buildForbiddenRules(targetRule),
    options: { ...baseConfig.options, progress: { type: 'none' } },
  } as IFlattenedRuleSet;
  const result = await cruise(
    [path.join(rootDir, FIXTURE_DIR, `${fixture}.ts`)],
    { validate: true, ruleSet },
    {},
    { tsConfig: parsedTsConfig },
  );
  const output = result.output;
  if (typeof output === 'string') {
    throw new Error(`dependency-cruiser 返回了非结构化结果: ${output}`);
  }
  return output.summary.violations;
}

describe('架构规则回归（dependency-cruiser fixture）', () => {
  it('拒绝 database → ai-core', async () => {
    const violations = await cruiseFixture('database-to-ai-core', 'infra-no-database-to-ai-core');
    expect(
      violations.some(
        (v) =>
          v.rule.name === 'infra-no-database-to-ai-core' &&
          v.to.startsWith('packages/ai-core/'),
      ),
    ).toBe(true);
  }, 30000);

  it('拒绝 ai-core → database', async () => {
    const violations = await cruiseFixture('ai-core-to-database', 'infra-no-ai-core-to-database');
    expect(
      violations.some(
        (v) =>
          v.rule.name === 'infra-no-ai-core-to-database' &&
          v.to.startsWith('packages/database/'),
      ),
    ).toBe(true);
  }, 30000);

  it('允许 application → domain（零违规）', async () => {
    const violations = await cruiseFixture('application-to-domain', null);
    expect(violations).toEqual([]);
  }, 30000);
});
