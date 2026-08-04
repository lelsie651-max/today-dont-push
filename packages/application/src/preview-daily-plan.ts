/**
 * 用例：每日计划预览（previewDailyPlan）。
 *
 * 第一条完整业务闭环的应用层编排：校验今日画像 → 确定性调度 → 返回完整日程。
 * 纯函数：不读取当前时间、环境变量或外部服务；失败返回原始结构化
 * DomainError，不 throw。
 *
 * 依赖约束：application 只允许依赖 domain（见 docs/architecture/overview.md）。
 */
import {
  createDailyPlanningInput,
  scheduleDailyPlan,
  type DailyPlanningInputInput,
  type DailySchedule,
  type DomainResult,
} from '@today-dont-push/domain';

/**
 * 预览命令：结构对齐 domain 的 DailyPlanningInputInput，
 * 但类型归属 application——API 层面向用例编程，不直接面向领域工厂入参。
 */
export interface PreviewDailyPlanCommand {
  readonly id: string;
  readonly localDate: string;
  readonly timeZone: string;
  readonly checkIn: DailyPlanningInputInput['checkIn'];
  readonly planningWindows: DailyPlanningInputInput['planningWindows'];
  readonly commitments: DailyPlanningInputInput['commitments'];
  readonly tasks: DailyPlanningInputInput['tasks'];
}

/**
 * 生成今日计划预览。
 *
 * 流程：
 * 1. 调用 createDailyPlanningInput 完成全部领域校验；失败时原样返回
 *    聚合的结构化 DomainError（不吞错、不重包装、不 throw）；
 * 2. 成功后调用 scheduleDailyPlan（其内部强制重新计算容量）并返回 DailySchedule。
 */
export function previewDailyPlan(
  command: PreviewDailyPlanCommand,
): DomainResult<DailySchedule> {
  const inputResult = createDailyPlanningInput(command);
  if (!inputResult.ok) {
    return { ok: false, errors: inputResult.errors };
  }
  return { ok: true, value: scheduleDailyPlan(inputResult.value) };
}
