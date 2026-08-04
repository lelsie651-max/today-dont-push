import { useMemo, useState, type FormEvent } from 'react';
import type { PlanPreviewSuccessResponse } from '@today-dont-push/contracts';
import {
  previewDailyPlan,
  type PlanPreviewClient,
} from '../../api/plan-preview-client';
import {
  buildPlanPreviewRequest,
} from './request-mapper';
import {
  apiErrorsToFormIssues,
  describeDeferredReason,
  describeScheduledItem,
  describeTimelineVariant,
  groupIssues,
  summarizeCapacity,
} from './presentation';
import {
  createBrowserId,
  createCommitmentDraft,
  createInitialFormState,
  createPlanningWindowDraft,
  createTaskDraft,
  ENERGY_DEMAND_OPTIONS,
  ENERGY_OPTIONS,
  ESTIMATED_MINUTES_OPTIONS,
  PRIORITY_OPTIONS,
  RESISTANCE_OPTIONS,
  STRAIN_OPTIONS,
  TASK_ENERGY_OPTIONS,
  type CreateId,
  type DailyPlanFormState,
  type TaskDraft,
} from './model';
import { getBrowserTimeZone, getTodayLocalDate } from './time';

export interface DailyPlanPageProps {
  readonly client?: PlanPreviewClient;
  readonly createId?: CreateId;
  readonly initialDate?: string;
}

type RequestState =
  | { readonly kind: 'idle'; readonly message: string | null }
  | { readonly kind: 'submitting'; readonly message: string | null }
  | { readonly kind: 'error'; readonly message: string };

function updateItemAtIndex<T>(
  items: readonly T[],
  index: number,
  updater: (value: T) => T,
): T[] {
  return items.map((item, currentIndex) => (currentIndex === index ? updater(item) : item));
}

function removeItemAtIndex<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, currentIndex) => currentIndex !== index);
}

function IssueList({
  messages,
  className = 'issue-list',
}: {
  readonly messages: readonly string[];
  readonly className?: string;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className={className}>
      {messages.map((message, index) => (
        <li key={`${message}-${index}`}>{message}</li>
      ))}
    </ul>
  );
}

function getTaskEstimatedMinutesLabel(task: TaskDraft): string {
  return task.estimatedMinutesPreset === 'custom'
    ? task.customEstimatedMinutes.trim()
    : task.estimatedMinutesPreset;
}

export function DailyPlanPage({
  client = previewDailyPlan,
  createId = createBrowserId,
  initialDate = getTodayLocalDate(),
}: DailyPlanPageProps) {
  const [form, setForm] = useState<DailyPlanFormState>(() => createInitialFormState(createId, initialDate));
  const [issues, setIssues] = useState<readonly { path: string; message: string }[]>([]);
  const [requestState, setRequestState] = useState<RequestState>({
    kind: 'idle',
    message: null,
  });
  const [result, setResult] = useState<PlanPreviewSuccessResponse['data'] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submittedTaskTitles, setSubmittedTaskTitles] = useState<Record<string, string>>({});
  const groupedIssues = useMemo(() => groupIssues(issues), [issues]);
  const mustItems = result?.scheduledItems.filter((item) => item.priority === 'must') ?? [];
  const minimumItems = result?.scheduledItems.filter((item) => item.variant === 'minimum') ?? [];
  const extraItems = result?.scheduledItems.filter(
    (item) => item.variant === 'full' && item.priority !== 'must',
  ) ?? [];

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
        <section className="panel panel-form">
          <form onSubmit={handleSubmit}>
            <div className="section-heading">
              <h2>今天的状态</h2>
              <p>先按今天真实的状态来，不用逞强。</p>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="local-date">
                今天是哪一天
              </label>
              <input
                id="local-date"
                className="text-input"
                type="date"
                value={form.localDate}
                onChange={(event) => setForm((current) => ({ ...current, localDate: event.target.value }))}
              />
            </div>

            <section className="field-group">
              <div className="field-header">
                <h3>当前电量</h3>
                <p>选最接近你今天体感的一档就好。</p>
              </div>
              <IssueList messages={groupedIssues.energyLevel} />
              <div className="energy-grid" role="radiogroup" aria-label="当前电量">
                {ENERGY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`energy-card ${form.energyLevel === option.value ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="energyLevel"
                      value={option.value}
                      checked={form.energyLevel === option.value}
                      onChange={() => setForm((current) => ({ ...current, energyLevel: option.value }))}
                    />
                    <span className="energy-card-title">{option.label}</span>
                    <span className="energy-card-copy">{option.description}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="field-group">
              <div className="field-header">
                <h3>今天的额外消耗</h3>
                <p>有就勾上，没有就留空。</p>
              </div>
              <IssueList messages={groupedIssues.strainTags} />
              <div className="checkbox-grid">
                {STRAIN_OPTIONS.map((option) => {
                  const checked = form.strainTags.includes(option.value);
                  return (
                    <label key={option.value} className={`check-card ${checked ? 'is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm((current) => {
                            const nextTags = checked
                              ? current.strainTags.filter((tag) => tag !== option.value)
                              : [...current.strainTags, option.value];
                            return {
                              ...current,
                              strainTags: nextTags,
                              otherNote:
                                option.value === 'other' && checked ? '' : current.otherNote,
                            };
                          });
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
              {form.strainTags.includes('other') ? (
                <div className="field-group nested-field">
                  <label className="field-label" htmlFor="other-note">
                    其他想说明一句
                  </label>
                  <textarea
                    id="other-note"
                    className="text-area"
                    rows={3}
                    value={form.otherNote}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, otherNote: event.target.value }))
                    }
                  />
                  <IssueList messages={groupedIssues.otherNote} />
                </div>
              ) : null}
            </section>

            <section className="field-group">
              <div className="field-header">
                <h3>今天允许安排的时间</h3>
                <p>默认从 09:00 到 18:00，你也可以拆成几段。</p>
              </div>
              <IssueList messages={groupedIssues.planningWindows} />
              <div className="stack-list">
                {form.planningWindows.map((window, index) => (
                  <article className="stack-card" key={window.id}>
                    <div className="stack-card-head">
                      <h4>可安排时间 {index + 1}</h4>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            planningWindows:
                              current.planningWindows.length === 1
                                ? current.planningWindows
                                : removeItemAtIndex(current.planningWindows, index),
                          }))
                        }
                        disabled={form.planningWindows.length === 1}
                      >
                        删除
                      </button>
                    </div>
                    <div className="time-row">
                      <label>
                        <span>开始</span>
                        <input
                          type="time"
                          value={window.startTime}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              planningWindows: updateItemAtIndex(current.planningWindows, index, (item) => ({
                                ...item,
                                startTime: event.target.value,
                              })),
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>结束</span>
                        <input
                          type="time"
                          value={window.endTime}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              planningWindows: updateItemAtIndex(current.planningWindows, index, (item) => ({
                                ...item,
                                endTime: event.target.value,
                              })),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <IssueList messages={groupedIssues.planningWindowByIndex[index] ?? []} />
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    planningWindows: [...current.planningWindows, createPlanningWindowDraft(createId)],
                  }))
                }
              >
                增加一段时间
              </button>
            </section>

            <section className="field-group">
              <div className="field-header">
                <h3>固定安排</h3>
                <p>会议、预约这类不能随便挪的事，先放进来。</p>
              </div>
              <IssueList messages={groupedIssues.commitments} />
              <div className="stack-list">
                {form.commitments.map((commitment, index) => (
                  <article className="stack-card" key={commitment.id}>
                    <div className="stack-card-head">
                      <h4>固定安排 {index + 1}</h4>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            commitments: removeItemAtIndex(current.commitments, index),
                          }))
                        }
                      >
                        删除
                      </button>
                    </div>
                    <label className="field-label">
                      标题
                      <input
                        className="text-input"
                        type="text"
                        value={commitment.title}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            commitments: updateItemAtIndex(current.commitments, index, (item) => ({
                              ...item,
                              title: event.target.value,
                            })),
                          }))
                        }
                      />
                    </label>
                    <div className="time-row">
                      <label>
                        <span>开始</span>
                        <input
                          type="time"
                          value={commitment.startAt}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              commitments: updateItemAtIndex(current.commitments, index, (item) => ({
                                ...item,
                                startAt: event.target.value,
                              })),
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>结束</span>
                        <input
                          type="time"
                          value={commitment.endAt}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              commitments: updateItemAtIndex(current.commitments, index, (item) => ({
                                ...item,
                                endAt: event.target.value,
                              })),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label className="field-label">
                      消耗程度
                      <select
                        className="text-input"
                        value={commitment.energyDemand}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            commitments: updateItemAtIndex(current.commitments, index, (item) => ({
                              ...item,
                              energyDemand: Number(event.target.value) as 1 | 3 | 5,
                            })),
                          }))
                        }
                      >
                        {ENERGY_DEMAND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <IssueList messages={groupedIssues.commitmentByIndex[index] ?? []} />
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    commitments: [...current.commitments, createCommitmentDraft(createId)],
                  }))
                }
              >
                添加会议或预约
              </button>
            </section>

            <section className="field-group">
              <div className="field-header">
                <h3>今天要做的事</h3>
                <p>至少保留一项，最多 10 项。</p>
              </div>
              <IssueList messages={groupedIssues.tasks} />
              <div className="stack-list">
                {form.tasks.map((task, index) => (
                  <article className="stack-card task-card" key={task.id}>
                    <div className="stack-card-head">
                      <h4>任务 {index + 1}</h4>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            tasks:
                              current.tasks.length === 1
                                ? current.tasks
                                : removeItemAtIndex(current.tasks, index),
                          }))
                        }
                        disabled={form.tasks.length === 1}
                      >
                        删除
                      </button>
                    </div>
                    <label className="field-label">
                      任务名称
                      <input
                        className="text-input"
                        type="text"
                        value={task.title}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                              ...item,
                              title: event.target.value,
                            })),
                          }))
                        }
                      />
                    </label>
                    <label className="field-label">
                      重要程度
                      <select
                        className="text-input"
                        value={task.priority}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                              ...item,
                              priority: event.target.value as TaskDraft['priority'],
                            })),
                          }))
                        }
                      >
                        {PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="split-fields">
                      <label className="field-label">
                        预计时间
                        <select
                          className="text-input"
                          value={task.estimatedMinutesPreset}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                ...item,
                                estimatedMinutesPreset: event.target.value as TaskDraft['estimatedMinutesPreset'],
                                customEstimatedMinutes:
                                  event.target.value === 'custom'
                                    ? item.customEstimatedMinutes
                                    : '',
                              })),
                            }))
                          }
                        >
                          {ESTIMATED_MINUTES_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {task.estimatedMinutesPreset === 'custom' ? (
                        <label className="field-label">
                          自定义分钟
                          <input
                            className="text-input"
                            type="number"
                            min={1}
                            value={task.customEstimatedMinutes}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                  ...item,
                                  customEstimatedMinutes: event.target.value,
                                })),
                              }))
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                    <div className="triple-fields">
                      <label className="field-label">
                        精力消耗
                        <select
                          className="text-input"
                          value={task.energyDemand}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                ...item,
                                energyDemand: Number(event.target.value) as 1 | 3 | 5,
                              })),
                            }))
                          }
                        >
                          {TASK_ENERGY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        启动阻力
                        <select
                          className="text-input"
                          value={task.emotionalResistance}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                ...item,
                                emotionalResistance: Number(event.target.value) as 0 | 1 | 2 | 3,
                              })),
                            }))
                          }
                        >
                          {RESISTANCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        可选截止时间
                        <input
                          className="text-input"
                          type="datetime-local"
                          value={task.deadlineAt}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                ...item,
                                deadlineAt: event.target.value,
                              })),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="minimum-section">
                      <button
                        type="button"
                        className="ghost-button"
                        aria-expanded={task.minimumVersionEnabled}
                        aria-controls={`minimum-version-${task.id}`}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                              ...item,
                              minimumVersionEnabled: !item.minimumVersionEnabled,
                              minimumTitle: item.minimumVersionEnabled ? '' : item.minimumTitle,
                              minimumEstimatedMinutes: item.minimumVersionEnabled
                                ? ''
                                : item.minimumEstimatedMinutes,
                              minimumEnergyDemand: item.minimumEnergyDemand,
                            })),
                          }))
                        }
                      >
                        {task.minimumVersionEnabled ? '收起过关版本' : '设置“做到哪一步就算过关”'}
                      </button>
                      {task.minimumVersionEnabled ? (
                        <div className="minimum-fields" id={`minimum-version-${task.id}`}>
                          <label className="field-label">
                            最低版本名称
                            <input
                              className="text-input"
                              type="text"
                              value={task.minimumTitle}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                    ...item,
                                    minimumTitle: event.target.value,
                                  })),
                                }))
                              }
                            />
                          </label>
                          <div className="split-fields">
                            <label className="field-label">
                              最低版本预计分钟
                              <input
                                className="text-input"
                                type="number"
                                min={1}
                                value={task.minimumEstimatedMinutes}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                      ...item,
                                      minimumEstimatedMinutes: event.target.value,
                                    })),
                                  }))
                                }
                              />
                            </label>
                            <label className="field-label">
                              最低版本精力消耗
                              <select
                                className="text-input"
                                value={task.minimumEnergyDemand}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    tasks: updateItemAtIndex(current.tasks, index, (item) => ({
                                      ...item,
                                      minimumEnergyDemand: Number(event.target.value) as 1 | 3 | 5,
                                    })),
                                  }))
                                }
                              >
                                {TASK_ENERGY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <IssueList messages={groupedIssues.taskByIndex[index] ?? []} />
                    <p className="task-meta">
                      当前预计：{getTaskEstimatedMinutesLabel(task)}
                      {' '}分钟
                    </p>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    tasks:
                      current.tasks.length >= 10
                        ? current.tasks
                        : [...current.tasks, createTaskDraft(createId)],
                  }))
                }
                disabled={form.tasks.length >= 10}
              >
                添加一件事
              </button>
            </section>

            <div className="submit-area">
              <div className="feedback-zone" aria-live="polite">
                <IssueList messages={groupedIssues.top} className="issue-list issue-list-top" />
                {requestState.kind === 'error' ? (
                  <div className="request-feedback" role="status">
                    <strong>这次没拿到结果</strong>
                    <p>{requestState.message}</p>
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                className="primary-button"
                disabled={requestState.kind === 'submitting'}
              >
                {requestState.kind === 'submitting' ? '正在替你留出余地……' : '看看今天先怎么安排'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel panel-result">
          <div className="section-heading">
            <h2>今天先这样</h2>
            <p>先把今天真正装得下的内容看清楚。</p>
          </div>

          {result === null ? (
            <div className="empty-state">
              <p>右侧会在生成后显示：容量摘要、时间线，以及今天可以先放下的事。</p>
            </div>
          ) : (
            <>
              <section className="result-block">
                <h3>今日容量摘要</h3>
                <ul className="summary-list">
                  {summarizeCapacity(result.capacity).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>

              <section className="result-block">
                <h3>今天必须守住</h3>
                {mustItems.length === 0 ? (
                  <p className="muted-copy">目前没有被安排进去的“必须守住”任务。</p>
                ) : (
                  <div className="result-list">
                    {mustItems.map((item) => (
                      <article className="result-card" key={`${item.taskId}-${item.decisionRank}`}>
                        <strong>{submittedTaskTitles[item.taskId] ?? item.title}</strong>
                        <p>{describeScheduledItem(item)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="result-block">
                <h3>今天这样做就够了</h3>
                {minimumItems.length === 0 ? (
                  <p className="muted-copy">今天还不需要把任务缩到最低版本。</p>
                ) : (
                  <div className="result-list">
                    {minimumItems.map((item) => {
                      const originalTitle = submittedTaskTitles[item.taskId] ?? item.taskId;
                      return (
                        <article className="result-card" key={`${item.taskId}-${item.decisionRank}`}>
                          <strong>{originalTitle}</strong>
                          <p>原任务已调整为：{item.title}</p>
                          <p>{describeScheduledItem(item)}</p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="result-block">
                <h3>有余力再做</h3>
                {extraItems.length === 0 ? (
                  <p className="muted-copy">今天先不再额外加码。</p>
                ) : (
                  <div className="result-list">
                    {extraItems.map((item) => (
                      <article className="result-card" key={`${item.taskId}-${item.decisionRank}`}>
                        <strong>{submittedTaskTitles[item.taskId] ?? item.title}</strong>
                        <p>{describeScheduledItem(item)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="result-block">
                <h3>今天可以不做</h3>
                {result.deferredItems.length === 0 ? (
                  <p className="muted-copy">目前没有被推迟的内容。</p>
                ) : (
                  <div className="result-list">
                    {result.deferredItems.map((item) => (
                      <article className="result-card" key={item.taskId}>
                        <strong>{submittedTaskTitles[item.taskId] ?? item.taskId}</strong>
                        <p>{describeDeferredReason(item)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="result-block">
                <h3>时间线</h3>
                <div className="timeline">
                  {result.scheduledItems.map((item) => (
                    <article className="timeline-item" key={`${item.taskId}-${item.decisionRank}`}>
                      <div>
                        <strong>{describeScheduledItem(item)}</strong>
                        <p>{submittedTaskTitles[item.taskId] ?? item.title}</p>
                      </div>
                      <span className={`timeline-badge ${item.variant === 'minimum' ? 'is-minimum' : ''}`}>
                        {describeTimelineVariant(item)}
                      </span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="result-block brand-action">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setConfirmed(true)}
                >
                  今天先这样
                </button>
                {confirmed ? (
                  <p className="confirm-copy">
                    计划不是契约。情况变了，之后还可以重新安排。
                  </p>
                ) : null}
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
