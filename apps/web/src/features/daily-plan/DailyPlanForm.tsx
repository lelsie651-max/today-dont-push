import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { createCommitmentDraft, createPlanningWindowDraft, createTaskDraft, ENERGY_OPTIONS, STRAIN_OPTIONS, type DailyPlanFormState } from './model';
import type { GroupedIssues } from './presentation';
import type { CreateId } from './model';
import { IssueList } from './IssueList';
import { PlanningWindowEditor } from './PlanningWindowEditor';
import { CommitmentEditor } from './CommitmentEditor';
import { TaskEditor } from './TaskEditor';

interface DailyPlanFormProps {
  readonly form: DailyPlanFormState;
  readonly setForm: Dispatch<SetStateAction<DailyPlanFormState>>;
  readonly groupedIssues: GroupedIssues;
  readonly requestState:
    | { readonly kind: 'idle'; readonly message: string | null }
    | { readonly kind: 'submitting'; readonly message: string | null }
    | { readonly kind: 'error'; readonly message: string };
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly createId: CreateId;
}

export function DailyPlanForm({
  form,
  setForm,
  groupedIssues,
  requestState,
  onSubmit,
  createId,
}: DailyPlanFormProps) {
  return (
    <section className="panel panel-form">
      <form onSubmit={onSubmit}>
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
                          otherNote: option.value === 'other' && checked ? '' : current.otherNote,
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
              <PlanningWindowEditor
                key={window.id}
                window={window}
                index={index}
                totalCount={form.planningWindows.length}
                issues={groupedIssues.planningWindowByIndex[index] ?? []}
                setForm={setForm}
              />
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
              <CommitmentEditor
                key={commitment.id}
                commitment={commitment}
                index={index}
                issues={groupedIssues.commitmentByIndex[index] ?? []}
                setForm={setForm}
              />
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
              <TaskEditor
                key={task.id}
                task={task}
                index={index}
                totalCount={form.tasks.length}
                issues={groupedIssues.taskByIndex[index] ?? []}
                setForm={setForm}
              />
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
  );
}
