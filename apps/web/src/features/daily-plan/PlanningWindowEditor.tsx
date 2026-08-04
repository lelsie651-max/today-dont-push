import type { Dispatch, SetStateAction } from 'react';
import type { DailyPlanFormState, PlanningWindowDraft } from './model';
import { IssueList } from './IssueList';

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

interface PlanningWindowEditorProps {
  readonly window: PlanningWindowDraft;
  readonly index: number;
  readonly totalCount: number;
  readonly issues: readonly string[];
  readonly setForm: Dispatch<SetStateAction<DailyPlanFormState>>;
}

export function PlanningWindowEditor({
  window,
  index,
  totalCount,
  issues,
  setForm,
}: PlanningWindowEditorProps) {
  return (
    <article className="stack-card">
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
          disabled={totalCount === 1}
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
      <IssueList messages={issues} />
    </article>
  );
}
