import type { Dispatch, SetStateAction } from 'react';
import type { CommitmentDraft, DailyPlanFormState } from './model';
import { ENERGY_DEMAND_OPTIONS } from './model';
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

interface CommitmentEditorProps {
  readonly commitment: CommitmentDraft;
  readonly index: number;
  readonly issues: readonly string[];
  readonly setForm: Dispatch<SetStateAction<DailyPlanFormState>>;
}

export function CommitmentEditor({
  commitment,
  index,
  issues,
  setForm,
}: CommitmentEditorProps) {
  return (
    <article className="stack-card">
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
      <IssueList messages={issues} />
    </article>
  );
}
