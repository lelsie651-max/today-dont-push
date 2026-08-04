/**
 * 应用层。
 *
 * 本包负责编排领域逻辑（用例），是唯一允许依赖 domain 的层。
 * 依赖约束：本包只允许依赖 domain（见 docs/architecture/overview.md）。
 */
import { DOMAIN_PACKAGE_NAME } from '@today-dont-push/domain';

export const APPLICATION_PACKAGE_NAME = '@today-dont-push/application' as const;

/** 占位说明：展示 application → domain 的合法依赖方向。 */
export function describeApplicationLayer(): string {
  return `${APPLICATION_PACKAGE_NAME} orchestrates ${DOMAIN_PACKAGE_NAME}`;
}

// 用例：每日计划预览（第一条完整业务闭环）
export type { PreviewDailyPlanCommand } from './preview-daily-plan.js';
export { previewDailyPlan } from './preview-daily-plan.js';
