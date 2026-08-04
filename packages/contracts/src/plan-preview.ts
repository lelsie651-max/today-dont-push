/**
 * 每日计划预览 API 契约（POST /v1/plans/preview）。
 *
 * 分层职责：Request Schema 只负责 JSON 结构与安全上限（字段形态、长度、
 * 数组规模），不重复领域业务规则——energyLevel 接受任意整数、priority
 * 接受任意字符串，是否合法由 domain 判定（非法时 API 返回 422）。
 * Response Schema 完整描述调度输出，不使用 any / unknown / passthrough。
 */
import { z } from 'zod';

// ---- 请求安全上限（结构层防线，业务规则不在此重复） ----

/** planningWindows 数组上限。 */
export const PLAN_PREVIEW_MAX_PLANNING_WINDOWS = 16;
/** commitments 数组上限。 */
export const PLAN_PREVIEW_MAX_COMMITMENTS = 64;
/** tasks 数组上限。 */
export const PLAN_PREVIEW_MAX_TASKS = 100;
/** strainTags 数组上限。 */
export const PLAN_PREVIEW_MAX_STRAIN_TAGS = 8;

const MAX_ID_LENGTH = 200;
const MAX_TITLE_LENGTH = 500;
const MAX_NOTE_LENGTH = 1000;
const MAX_LOCAL_DATE_LENGTH = 16;
const MAX_TIME_ZONE_LENGTH = 128;

/** 毫秒时间戳：必须是有限安全整数，避免传输层静默丢精度。 */
const timestampSchema = z.number().int().finite().safe();

const timeWindowSchema = z.strictObject({
  startAtMs: timestampSchema,
  endAtMs: timestampSchema,
});

const checkInSchema = z.strictObject({
  id: z.string().min(1).max(MAX_ID_LENGTH),
  // 接受任意整数：是否为 20 / 50 / 80 由 domain 判定。
  energyLevel: z.number().int(),
  strainTags: z.array(z.string().min(1)).max(PLAN_PREVIEW_MAX_STRAIN_TAGS),
  note: z.string().max(MAX_NOTE_LENGTH).optional(),
});

const commitmentSchema = z.strictObject({
  id: z.string().min(1).max(MAX_ID_LENGTH),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  window: timeWindowSchema,
  energyDemand: z.number().int(),
});

const minimumVersionSchema = z.strictObject({
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  estimatedMinutes: z.number().int(),
  energyDemand: z.number().int(),
});

const taskSchema = z.strictObject({
  id: z.string().min(1).max(MAX_ID_LENGTH),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  // 接受任意字符串：must / important / optional 的判定属于领域规则。
  priority: z.string().min(1),
  estimatedMinutes: z.number().int(),
  energyDemand: z.number().int(),
  emotionalResistance: z.number().int(),
  deadlineAtMs: timestampSchema.optional(),
  minimumVersion: minimumVersionSchema.optional(),
});

/** 每日计划预览请求契约：JSON 结构 + 安全上限。 */
export const PlanPreviewRequestSchema = z.strictObject({
  id: z.string().min(1).max(MAX_ID_LENGTH),
  localDate: z.string().min(1).max(MAX_LOCAL_DATE_LENGTH),
  timeZone: z.string().min(1).max(MAX_TIME_ZONE_LENGTH),
  checkIn: checkInSchema,
  planningWindows: z.array(timeWindowSchema).max(PLAN_PREVIEW_MAX_PLANNING_WINDOWS),
  commitments: z.array(commitmentSchema).max(PLAN_PREVIEW_MAX_COMMITMENTS),
  tasks: z.array(taskSchema).max(PLAN_PREVIEW_MAX_TASKS),
});

export type PlanPreviewRequest = z.infer<typeof PlanPreviewRequestSchema>;

// ---- 响应契约：完整描述调度输出 ----

const sharedTimeWindowSchema = z.strictObject({
  startAtMs: z.number(),
  endAtMs: z.number(),
});

/** 原因中的数值字典（reason.values）。 */
const reasonValuesSchema = z.record(z.string(), z.number());

const capacityReasonSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  values: reasonValuesSchema,
});

const capacityAnalysisSchema = z.strictObject({
  policyVersion: z.literal('energy-policy-v1'),
  totalPlanningMinutes: z.number().int(),
  fixedCommitmentMinutes: z.number().int(),
  freeMinutes: z.number().int(),
  protectedBufferMinutes: z.number().int(),
  schedulableMinutes: z.number().int(),
  baseEnergyPoints: z.number().int(),
  strainPenaltyPoints: z.number().int(),
  adjustedEnergyPoints: z.number().int(),
  commitmentEnergyCostPoints: z.number().int(),
  remainingEnergyPoints: z.number().int(),
  freeSlots: z.array(sharedTimeWindowSchema),
  capacityState: z.enum(['exhausted_by_commitments', 'commitment_heavy', 'available']),
  reasons: z.array(capacityReasonSchema),
});

const taskPrioritySchema = z.enum(['must', 'important', 'optional']);
const taskCostVariantSchema = z.enum(['full', 'minimum']);

const placementReasonCodeSchema = z.enum([
  'FULL_VERSION_SELECTED',
  'MINIMUM_SELECTED_LOW_ENERGY',
  'MINIMUM_SELECTED_COMMITMENT_HEAVY',
  'MINIMUM_SELECTED_BALANCED_ENERGY',
  'MINIMUM_SELECTED_TO_PROTECT_MUST_COVERAGE',
  'MINIMUM_SELECTED_AS_FALLBACK',
]);

const deferredReasonCodeSchema = z.enum([
  'CAPACITY_EXHAUSTED',
  'INSUFFICIENT_ENERGY',
  'INSUFFICIENT_TOTAL_MINUTES',
  'NO_CONTIGUOUS_SLOT',
  'DEADLINE_CANNOT_BE_MET',
]);

const scheduledItemSchema = z.strictObject({
  taskId: z.string(),
  title: z.string(),
  priority: taskPrioritySchema,
  variant: taskCostVariantSchema,
  window: sharedTimeWindowSchema,
  minutes: z.number().int(),
  energyCostPoints: z.number().int(),
  reasonCodes: z.array(placementReasonCodeSchema),
  decisionRank: z.number().int(),
});

const scheduleDeferredReasonSchema = z.strictObject({
  code: deferredReasonCodeSchema,
  message: z.string(),
  values: reasonValuesSchema,
});

const deferredItemSchema = z.strictObject({
  taskId: z.string(),
  priority: taskPrioritySchema,
  attemptedVariants: z.array(taskCostVariantSchema),
  reasons: z.array(scheduleDeferredReasonSchema),
  reasonCodes: z.array(deferredReasonCodeSchema),
});

/** 完整调度输出契约（DailySchedule 的逐字段描述）。 */
export const DailyScheduleSchema = z.strictObject({
  policyVersion: z.literal('task-scheduling-policy-v1'),
  energyPolicyVersion: z.literal('energy-policy-v1'),
  capacity: capacityAnalysisSchema,
  scheduledItems: z.array(scheduledItemSchema),
  deferredItems: z.array(deferredItemSchema),
  remainingSchedulableMinutes: z.number().int(),
  remainingEnergyPoints: z.number().int(),
  mustTaskDeferredIds: z.array(z.string()),
});
export type DailySchedule = z.infer<typeof DailyScheduleSchema>;

/** 错误条目：400 的 code 为 Zod 问题码，422 的 code 为领域错误码。 */
const planPreviewErrorSchema = z.strictObject({
  code: z.string().min(1),
  path: z.string(),
  message: z.string(),
});

/** 200：调度成功。 */
export const PlanPreviewSuccessResponseSchema = z.strictObject({
  status: z.literal('ok'),
  data: DailyScheduleSchema,
});

/** 400：请求 JSON 结构不合法（缺字段、未知字段、超过安全上限）。 */
export const PlanPreviewInvalidRequestResponseSchema = z.strictObject({
  status: z.literal('invalid_request'),
  errors: z.array(planPreviewErrorSchema).min(1),
});

/** 422：结构合法但违反领域规则。 */
export const PlanPreviewInvalidInputResponseSchema = z.strictObject({
  status: z.literal('invalid_input'),
  errors: z.array(planPreviewErrorSchema).min(1),
});

/** 三类响应的可辨识联合。 */
export const PlanPreviewResponseSchema = z.discriminatedUnion('status', [
  PlanPreviewSuccessResponseSchema,
  PlanPreviewInvalidRequestResponseSchema,
  PlanPreviewInvalidInputResponseSchema,
]);

export type PlanPreviewSuccessResponse = z.infer<typeof PlanPreviewSuccessResponseSchema>;
export type PlanPreviewInvalidRequestResponse = z.infer<
  typeof PlanPreviewInvalidRequestResponseSchema
>;
export type PlanPreviewInvalidInputResponse = z.infer<
  typeof PlanPreviewInvalidInputResponseSchema
>;
export type PlanPreviewResponse = z.infer<typeof PlanPreviewResponseSchema>;
