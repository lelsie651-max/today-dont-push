import type { Dispatch, SetStateAction } from 'react';
import {
  ESTIMATED_MINUTES_OPTIONS,
  PRIORITY_OPTIONS,
  RESISTANCE_OPTIONS,
  TASK_ENERGY_OPTIONS,
  type DailyPlanFormState,
  type TaskDraft,
} from './model';
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

function getTaskEstimatedMinutesLabel(task: TaskDraft): string {
  return task.estimatedMinutesPreset === 'custom'
    ? task.customEstimatedMinutes.trim()
    : task.estimatedMinutesPreset;
}

interface TaskEditorProps {
  readonly task: TaskDraft;
  readonly index: number;
  readonly totalCount: number;
  readonly issues: readonly string[];
  readonly setForm: Dispatch<SetStateAction<DailyPlanFormState>>;
}

export function TaskEditor({
  task,
  index,
  totalCount,
  issues,
  setForm,
}: TaskEditorProps) {
  return (
    <article className="stack-card task-card">
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
          disabled={totalCount === 1}
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
                  customEstimatedMinutes: event.target.value === 'custom' ? item.customEstimatedMinutes : '',
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
                minimumEstimatedMinutes: item.minimumVersionEnabled ? '' : item.minimumEstimatedMinutes,
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
      <IssueList messages={issues} />
      <p className="task-meta">当前预计：{getTaskEstimatedMinutesLabel(task)} 分钟</p>
    </article>
  );
}
