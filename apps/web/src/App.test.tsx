import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ComponentProps } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PlanPreviewRequest, PlanPreviewSuccessResponse } from '@today-dont-push/contracts';
import type { PlanPreviewClient, PlanPreviewClientResult } from './api/plan-preview-client';
import App from './App';

function createIdFactory() {
  let value = 0;
  return () => {
    value += 1;
    return `id-${value}`;
  };
}

function renderApp(
  overrides: Partial<ComponentProps<typeof App>> = {},
) {
  const client: PlanPreviewClient =
    overrides.client ??
    (vi.fn(async () => ({ kind: 'success' as const, response: successResponse })) as PlanPreviewClient);
  return {
    client,
    ...render(
      <App
        client={client}
        createId={overrides.createId ?? createIdFactory()}
        initialDate={overrides.initialDate ?? '2026-08-04'}
      />,
    ),
  };
}

const successResponse: PlanPreviewSuccessResponse = {
  status: 'ok',
  data: {
    policyVersion: 'task-scheduling-policy-v1',
    energyPolicyVersion: 'energy-policy-v1',
    capacity: {
      policyVersion: 'energy-policy-v1',
      totalPlanningMinutes: 540,
      fixedCommitmentMinutes: 60,
      freeMinutes: 480,
      protectedBufferMinutes: 45,
      schedulableMinutes: 435,
      baseEnergyPoints: 50,
      strainPenaltyPoints: 4,
      adjustedEnergyPoints: 46,
      commitmentEnergyCostPoints: 3,
      remainingEnergyPoints: 32,
      freeSlots: [{ startAtMs: 1_801_000_000_000, endAtMs: 1_801_001_800_000 }],
      capacityState: 'commitment_heavy',
      reasons: [],
    },
    scheduledItems: [
      {
        taskId: 'id-2',
        title: '把周报写完',
        priority: 'must',
        variant: 'full',
        window: { startAtMs: 1_801_000_000_000, endAtMs: 1_801_003_600_000 },
        minutes: 60,
        energyCostPoints: 3,
        reasonCodes: ['FULL_VERSION_SELECTED'],
        decisionRank: 0,
      },
      {
        taskId: 'id-3',
        title: '先写开头',
        priority: 'important',
        variant: 'minimum',
        window: { startAtMs: 1_801_004_000_000, endAtMs: 1_801_004_900_000 },
        minutes: 15,
        energyCostPoints: 1,
        reasonCodes: ['MINIMUM_SELECTED_AS_FALLBACK'],
        decisionRank: 1,
      },
      {
        taskId: 'id-4',
        title: '整理桌面',
        priority: 'optional',
        variant: 'full',
        window: { startAtMs: 1_801_005_000_000, endAtMs: 1_801_006_800_000 },
        minutes: 30,
        energyCostPoints: 1,
        reasonCodes: ['FULL_VERSION_SELECTED'],
        decisionRank: 2,
      },
    ],
    deferredItems: [
      {
        taskId: 'id-5',
        priority: 'optional',
        attemptedVariants: ['full'],
        reasons: [
          {
            code: 'INSUFFICIENT_TOTAL_MINUTES',
            message: '剩余时间不够',
            values: { remainingSchedulableMinutes: 20, requiredMinutes: 90 },
          },
        ],
        reasonCodes: ['INSUFFICIENT_TOTAL_MINUTES'],
      },
    ],
    remainingSchedulableMinutes: 120,
    remainingEnergyPoints: 32,
    mustTaskDeferredIds: [],
  },
};

async function fillRequiredTask(user: ReturnType<typeof userEvent.setup>, title = '把周报写完') {
  await user.clear(screen.getByLabelText('任务名称'));
  await user.type(screen.getByLabelText('任务名称'), title);
}

function expectRequestPayload(request: PlanPreviewRequest | null): PlanPreviewRequest {
  if (request === null) {
    throw new Error('请求未捕获');
  }
  return request;
}

describe('App', () => {
  it('默认显示 20/50/80 三档状态', () => {
    renderApp();
    expect(screen.getByRole('radio', { name: /20%/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /50%/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /80%/ })).toBeInTheDocument();
  });

  it('选择 other 后出现 note，取消后清空', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('checkbox', { name: '其他' }));
    const note = screen.getByLabelText('其他想说明一句');
    await user.type(note, '今天还有点别的消耗');
    expect(note).toHaveValue('今天还有点别的消耗');

    await user.click(screen.getByRole('checkbox', { name: '其他' }));
    expect(screen.queryByLabelText('其他想说明一句')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '其他' }));
    expect(screen.getByLabelText('其他想说明一句')).toHaveValue('');
  });

  it('可以添加和删除任务', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: '添加一件事' }));
    expect(screen.getAllByRole('heading', { name: /任务 \d/ })).toHaveLength(2);

    const secondTask = screen.getByRole('heading', { name: '任务 2' }).closest('article');
    if (secondTask === null) {
      throw new Error('任务 2 卡片不存在');
    }
    await user.click(within(secondTask).getByRole('button', { name: '删除' }));
    expect(screen.getAllByRole('heading', { name: /任务 \d/ })).toHaveLength(1);
  });

  it('自然选项会正确映射为 API 请求字段', async () => {
    const user = userEvent.setup();
    let capturedRequest: PlanPreviewRequest | null = null;
    const client = vi.fn(async (request: PlanPreviewRequest) => {
      capturedRequest = request;
      return { kind: 'success' as const, response: successResponse };
    });
    renderApp({ client });

    await user.click(screen.getByRole('radio', { name: /20%/ }));
    await user.click(screen.getByRole('checkbox', { name: '没睡好' }));
    await user.click(screen.getByRole('checkbox', { name: '通勤很累' }));
    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));

    await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
    const requestPayload = expectRequestPayload(capturedRequest);
    expect(requestPayload.checkIn.energyLevel).toBe(20);
    expect(requestPayload.checkIn.strainTags).toEqual(['poor_sleep', 'exhausting_commute']);
    expect(requestPayload.planningWindows[0]).toEqual({
      startAtMs: new Date('2026-08-04T09:00:00').getTime(),
      endAtMs: new Date('2026-08-04T18:00:00').getTime(),
    });
  });

  it('minimum 折叠区会正确提交', async () => {
    const user = userEvent.setup();
    let capturedRequest: PlanPreviewRequest | null = null;
    const client = vi.fn(async (request: PlanPreviewRequest) => {
      capturedRequest = request;
      return { kind: 'success' as const, response: successResponse };
    });
    renderApp({ client });

    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '设置“做到哪一步就算过关”' }));
    await user.type(screen.getByLabelText('最低版本名称'), '先写开头');
    await user.type(screen.getByLabelText('最低版本预计分钟'), '15');
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));

    await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
    const requestPayload = expectRequestPayload(capturedRequest);
    expect(requestPayload.tasks[0]?.minimumVersion).toEqual({
      title: '先写开头',
      estimatedMinutes: 15,
      energyDemand: 1,
    });
  });

  it('400 错误会定位到对应任务', async () => {
    const user = userEvent.setup();
    const client = vi.fn(async () => ({
      kind: 'invalid_request' as const,
      response: {
        status: 'invalid_request' as const,
        errors: [{ code: 'invalid_type', path: 'tasks[0].title', message: '标题格式不对' }],
      },
    }));
    renderApp({ client });

    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));

    const taskCard = screen.getByRole('heading', { name: '任务 1' }).closest('article');
    if (taskCard === null) {
      throw new Error('任务卡片不存在');
    }
    expect(await within(taskCard).findByText('标题格式不对')).toBeInTheDocument();
  });

  it('422 错误会定位到对应任务', async () => {
    const user = userEvent.setup();
    const client = vi.fn(async () => ({
      kind: 'invalid_input' as const,
      response: {
        status: 'invalid_input' as const,
        errors: [
          {
            code: 'INVALID_PRIORITY',
            path: 'tasks[0].priority',
            message: '这件事的重要程度不合法',
          },
        ],
      },
    }));
    renderApp({ client });

    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));

    const taskCard = screen.getByRole('heading', { name: '任务 1' }).closest('article');
    if (taskCard === null) {
      throw new Error('任务卡片不存在');
    }
    expect(await within(taskCard).findByText('这件事的重要程度不合法')).toBeInTheDocument();
  });

  it('成功结果会区分 full、minimum 和 deferred', async () => {
    const user = userEvent.setup();
    renderApp({
      client: vi.fn(async () => ({ kind: 'success' as const, response: successResponse })),
      createId: createIdFactory(),
    });

    await fillRequiredTask(user, '把周报写完');
    await user.click(screen.getByRole('button', { name: '添加一件事' }));
    await user.type(screen.getAllByLabelText('任务名称')[1]!, '整理资料');
    await user.click(screen.getByRole('button', { name: '添加一件事' }));
    await user.type(screen.getAllByLabelText('任务名称')[2]!, '整理桌面');
    await user.click(screen.getByRole('button', { name: '添加一件事' }));
    await user.type(screen.getAllByLabelText('任务名称')[3]!, '可以明天做');

    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));

    expect(await screen.findByRole('heading', { name: '今日容量摘要' })).toBeInTheDocument();
    expect(screen.getAllByText('把周报写完').length).toBeGreaterThan(0);
    expect(screen.getByText('原任务已调整为：先写开头')).toBeInTheDocument();
    expect(screen.getAllByText('整理桌面').length).toBeGreaterThan(0);
    expect(screen.getByText('今天剩余的整块时间不够。')).toBeInTheDocument();
  });

  it('点击“今天先这样”会显示确认文案', async () => {
    const user = userEvent.setup();
    renderApp();

    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));
    await screen.findByRole('heading', { name: '今日容量摘要' });

    await user.click(screen.getByRole('button', { name: '今天先这样' }));
    expect(
      screen.getByText('计划不是契约。情况变了，之后还可以重新安排。'),
    ).toBeInTheDocument();
  });

  it('请求期间会禁用按钮并防止重复提交', async () => {
    const user = userEvent.setup();
    let resolveRequest: ((value: PlanPreviewClientResult) => void) | undefined;
    const client = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    ) as PlanPreviewClient;
    renderApp({ client });

    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));
    await user.click(screen.getByRole('button', { name: '正在替你留出余地……' }));

    expect(client).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '正在替你留出余地……' })).toBeDisabled();

    resolveRequest?.({ kind: 'success', response: successResponse });
    await screen.findByRole('heading', { name: '今日容量摘要' });
  });

  it('网络失败会显示友好提示', async () => {
    const user = userEvent.setup();
    renderApp({
      client: vi.fn(async () => ({
        kind: 'network_error' as const,
        message: '暂时连不上服务，请确认前后端都已启动后重试。',
      })),
    });

    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));
    expect(await screen.findByText('暂时连不上服务，请确认前后端都已启动后重试。')).toBeInTheDocument();
  });

  it('超时会显示友好提示', async () => {
    const user = userEvent.setup();
    renderApp({
      client: vi.fn(async () => ({
        kind: 'timeout' as const,
        message: '这次等待有点久，我们先停一下，稍后再试。',
      })),
    });

    await fillRequiredTask(user);
    await user.click(screen.getByRole('button', { name: '看看今天先怎么安排' }));
    expect(await screen.findByText('这次等待有点久，我们先停一下，稍后再试。')).toBeInTheDocument();
  });

  it('App 不直接导入 domain 或 application', () => {
    const source = readFileSync(resolve(process.cwd(), 'apps/web/src/App.tsx'), 'utf8');
    expect(source).not.toContain('@today-dont-push/domain');
    expect(source).not.toContain('@today-dont-push/application');
  });
});
