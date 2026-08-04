import { useMemo, useState, type FormEvent } from 'react';
import type { DailySchedule } from '@today-dont-push/contracts';
import { previewDailyPlan, type PlanPreviewClient } from '../../api/plan-preview-client';
import { buildPlanPreviewRequest } from './request-mapper';
import { apiErrorsToFormIssues, groupIssues } from './presentation';
import { createBrowserId, createInitialFormState, type CreateId, type DailyPlanFormState, type FormIssue } from './model';
import { getBrowserTimeZone, getTodayLocalDate } from './time';
import { DailyPlanForm } from './DailyPlanForm';
import { PlanResultPanel } from './PlanResultPanel';

export interface DailyPlanPageProps {
  readonly client?: PlanPreviewClient;
  readonly createId?: CreateId;
  readonly initialDate?: string;
}

type RequestState =
  | { readonly kind: 'idle'; readonly message: string | null }
  | { readonly kind: 'submitting'; readonly message: string | null }
  | { readonly kind: 'error'; readonly message: string };

export function DailyPlanPage({
  client = previewDailyPlan,
  createId = createBrowserId,
  initialDate = getTodayLocalDate(),
}: DailyPlanPageProps) {
  const [form, setForm] = useState<DailyPlanFormState>(() => createInitialFormState(createId, initialDate));
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [requestState, setRequestState] = useState<RequestState>({
    kind: 'idle',
    message: null,
  });
  const [result, setResult] = useState<DailySchedule | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submittedTaskTitles, setSubmittedTaskTitles] = useState<Record<string, string>>({});
  const groupedIssues = useMemo(() => groupIssues(issues), [issues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestState.kind === 'submitting') {
      return;
    }

    setIssues([]);
    setConfirmed(false);
    setResult(null);
    setRequestState({ kind: 'submitting', message: null });

    const requestResult = buildPlanPreviewRequest(form, {
      createId,
      timeZone: getBrowserTimeZone(),
    });

    if (!requestResult.ok) {
      setIssues(requestResult.errors);
      setRequestState({ kind: 'idle', message: null });
      return;
    }

    setSubmittedTaskTitles(
      Object.fromEntries(form.tasks.map((task) => [task.id, task.title.trim() || '未命名任务'])),
    );

    const apiResult = await client(requestResult.request);
    if (apiResult.kind === 'success') {
      setResult(apiResult.response.data);
      setRequestState({ kind: 'idle', message: null });
      return;
    }

    if (apiResult.kind === 'invalid_request' || apiResult.kind === 'invalid_input') {
      setIssues(apiErrorsToFormIssues(apiResult.response.errors));
      setRequestState({ kind: 'idle', message: null });
      return;
    }

    setRequestState({
      kind: 'error',
      message: apiResult.message,
    });
  }

  return (
    <main className="daily-plan-page">
      <header className="hero">
        <p className="hero-eyebrow">今天别硬撑</p>
        <h1>今天别硬撑</h1>
        <p className="hero-subtitle">按你今天真正剩下的力气，守住最重要的事。</p>
      </header>

      <div className="layout">
        <DailyPlanForm
          form={form}
          setForm={setForm}
          groupedIssues={groupedIssues}
          requestState={requestState}
          onSubmit={handleSubmit}
          createId={createId}
        />
        <PlanResultPanel
          result={result}
          submittedTaskTitles={submittedTaskTitles}
          confirmed={confirmed}
          onConfirm={() => setConfirmed(true)}
        />
      </div>
    </main>
  );
}
