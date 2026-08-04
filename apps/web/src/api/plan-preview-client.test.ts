import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanPreviewRequest } from '@today-dont-push/contracts';
import { previewDailyPlan } from './plan-preview-client';

const request: PlanPreviewRequest = {
  id: 'plan-1',
  localDate: '2026-08-04',
  timeZone: 'Asia/Shanghai',
  checkIn: {
    id: 'checkin-1',
    energyLevel: 50,
    strainTags: ['poor_sleep'],
  },
  planningWindows: [{ startAtMs: 1_800_000_000_000, endAtMs: 1_800_003_600_000 }],
  commitments: [],
  tasks: [
    {
      id: 'task-1',
      title: '写周报',
      priority: 'must',
      estimatedMinutes: 60,
      energyDemand: 3,
      emotionalResistance: 1,
    },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('previewDailyPlan', () => {
  it('成功响应会通过 contracts 解析', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          status: 'ok',
          data: {
            policyVersion: 'task-scheduling-policy-v1',
            energyPolicyVersion: 'energy-policy-v1',
            capacity: {
              policyVersion: 'energy-policy-v1',
              totalPlanningMinutes: 240,
              fixedCommitmentMinutes: 0,
              freeMinutes: 240,
              protectedBufferMinutes: 25,
              schedulableMinutes: 215,
              baseEnergyPoints: 50,
              strainPenaltyPoints: 6,
              adjustedEnergyPoints: 44,
              commitmentEnergyCostPoints: 0,
              remainingEnergyPoints: 40,
              freeSlots: [{ startAtMs: 1_800_000_000_000, endAtMs: 1_800_003_600_000 }],
              capacityState: 'available',
              reasons: [],
            },
            scheduledItems: [],
            deferredItems: [],
            remainingSchedulableMinutes: 215,
            remainingEnergyPoints: 40,
            mustTaskDeferredIds: [],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    });

    const result = await previewDailyPlan(request, { fetchImpl });
    expect(result.kind).toBe('success');
  });

  it('非法响应会被识别为客户端错误', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          status: 'ok',
          data: { broken: true },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    });

    const result = await previewDailyPlan(request, { fetchImpl });
    expect(result).toEqual({
      kind: 'client_error',
      message: '服务返回的结果和公开契约不一致，请稍后再试。',
    });
  });

  it('超时会返回友好结果', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );

    const pending = previewDailyPlan(request, { fetchImpl, timeoutMs: 10 });
    await vi.advanceTimersByTimeAsync(20);

    await expect(pending).resolves.toEqual({
      kind: 'timeout',
      message: '这次等待有点久，我们先停一下，稍后再试。',
    });
  });
});
