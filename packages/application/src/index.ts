import { DOMAIN_PACKAGE_NAME } from '@today-dont-push/domain';

/**
 * 应用层（占位）。
 *
 * 本包负责编排领域逻辑（用例），是唯一允许依赖 domain 的层。
 * 本轮不实现任何用例，仅保证包可编译、可测试。
 *
 * 依赖约束：本包只允许依赖 domain（见 docs/architecture/overview.md）。
 */
export const APPLICATION_PACKAGE_NAME = '@today-dont-push/application' as const;

/** 占位说明：展示 application → domain 的合法依赖方向。 */
export function describeApplicationLayer(): string {
  return `${APPLICATION_PACKAGE_NAME} orchestrates ${DOMAIN_PACKAGE_NAME}`;
}
