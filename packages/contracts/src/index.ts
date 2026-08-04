import { z } from 'zod';

/**
 * 健康检查响应契约。
 * `apps/api` 的 GET /health 必须返回该结构，前后端与测试以此为准。
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// 每日计划预览契约（POST /v1/plans/preview）
export {
  PLAN_PREVIEW_MAX_COMMITMENTS,
  PLAN_PREVIEW_MAX_PLANNING_WINDOWS,
  PLAN_PREVIEW_MAX_STRAIN_TAGS,
  PLAN_PREVIEW_MAX_TASKS,
  DailyScheduleSchema,
  PlanPreviewInvalidInputResponseSchema,
  PlanPreviewInvalidRequestResponseSchema,
  PlanPreviewRequestSchema,
  PlanPreviewResponseSchema,
  PlanPreviewSuccessResponseSchema,
} from './plan-preview.js';
export type {
  DailySchedule,
  PlanPreviewInvalidInputResponse,
  PlanPreviewInvalidRequestResponse,
  PlanPreviewRequest,
  PlanPreviewResponse,
  PlanPreviewSuccessResponse,
} from './plan-preview.js';
