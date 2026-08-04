import type { FastifyReply } from 'fastify';
import {
  PlanPreviewInvalidInputResponseSchema,
  PlanPreviewInvalidRequestResponseSchema,
  PlanPreviewSuccessResponseSchema,
  type PlanPreviewInvalidInputResponse,
  type PlanPreviewInvalidRequestResponse,
} from '@today-dont-push/contracts';
import type { ZodIssue } from 'zod';

/** 把 Zod 的 issue path 转换为 `tasks[0].title` 风格的契约路径。 */
export function toContractPath(path: readonly PropertyKey[]): string {
  let result = '';
  for (const segment of path) {
    const text = String(segment);
    if (/^\d+$/.test(text)) {
      result += `[${text}]`;
    } else if (result === '') {
      result = text;
    } else {
      result += `.${text}`;
    }
  }
  return result;
}

/**
 * 把 Zod issue 转为 400 错误条目。
 *
 * `unrecognized_keys` 需要把每个未知 key 展开成独立错误，并把 key 写入 path，
 * 不能仅藏在 message 中。
 */
export function zodIssuesToInvalidRequestErrors(
  issues: readonly ZodIssue[],
): PlanPreviewInvalidRequestResponse['errors'] {
  const errors: PlanPreviewInvalidRequestResponse['errors'] = [];

  issues.forEach((issue) => {
    if (issue.code !== 'unrecognized_keys') {
      errors.push({
        code: issue.code,
        path: toContractPath(issue.path),
        message: issue.message,
      });
      return;
    }

    issue.keys.forEach((key) => {
      errors.push({
        code: issue.code,
        path: toContractPath([...issue.path, key]),
        message: issue.message,
      });
    });
  });

  return errors;
}

export function sendPlanPreviewInvalidRequest(
  reply: FastifyReply,
  errors: PlanPreviewInvalidRequestResponse['errors'],
) {
  const payload = PlanPreviewInvalidRequestResponseSchema.parse({
    status: 'invalid_request',
    errors,
  });
  return reply.status(400).send(payload);
}

export function sendPlanPreviewInvalidInput(
  reply: FastifyReply,
  errors: PlanPreviewInvalidInputResponse['errors'],
) {
  const payload = PlanPreviewInvalidInputResponseSchema.parse({
    status: 'invalid_input',
    errors,
  });
  return reply.status(422).send(payload);
}

export function sendPlanPreviewSuccess(reply: FastifyReply, data: unknown) {
  const payload = PlanPreviewSuccessResponseSchema.parse({
    status: 'ok',
    data,
  });
  return reply.status(200).send(payload);
}
