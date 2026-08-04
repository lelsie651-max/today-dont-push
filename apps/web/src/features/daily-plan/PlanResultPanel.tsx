import type { DailySchedule } from '@today-dont-push/contracts';
import {
  describeDeferredReason,
  describeScheduledItem,
  describeTimelineVariant,
  groupScheduledItems,
  summarizeCapacity,
} from './presentation';

interface PlanResultPanelProps {
  readonly result: DailySchedule | null;
  readonly submittedTaskTitles: Readonly<Record<string, string>>;
  readonly confirmed: boolean;
  readonly onConfirm: () => void;
}

export function PlanResultPanel({
  result,
  submittedTaskTitles,
  confirmed,
  onConfirm,
}: PlanResultPanelProps) {
  const groupedItems = result === null ? null : groupScheduledItems(result);

  return (
    <section className="panel panel-result">
      <div className="section-heading">
        <h2>今天先这样</h2>
        <p>先把今天真正装得下的内容看清楚。</p>
      </div>

      {result === null || groupedItems === null ? (
        <div className="empty-state">
          <p>右侧会在生成后显示：容量摘要、时间线，以及今天可以先放下的事。</p>
        </div>
      ) : (
        <>
          <section className="result-block">
            <h3>今日容量摘要</h3>
            <ul className="summary-list">
              {summarizeCapacity(result).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="result-block">
            <h3>今天必须守住</h3>
            {groupedItems.mustItems.length === 0 ? (
              <p className="muted-copy">目前没有被安排进去的“必须守住”任务。</p>
            ) : (
              <div className="result-list">
                {groupedItems.mustItems.map((item) => {
                  const originalTitle = submittedTaskTitles[item.taskId] ?? item.taskId;
                  return (
                    <article className="result-card" key={`${item.taskId}-${item.decisionRank}`}>
                      <strong>{originalTitle}</strong>
                      {item.variant === 'minimum' ? <p>今天守住：{item.title}</p> : null}
                      <p>{describeScheduledItem(item)}</p>
                      <p className="timeline-badge-inline">{describeTimelineVariant(item)}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="result-block">
            <h3>今天这样做就够了</h3>
            {groupedItems.minimumItems.length === 0 ? (
              <p className="muted-copy">今天还不需要把任务缩到最低版本。</p>
            ) : (
              <div className="result-list">
                {groupedItems.minimumItems.map((item) => {
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
            {groupedItems.extraItems.length === 0 ? (
              <p className="muted-copy">今天先不再额外加码。</p>
            ) : (
              <div className="result-list">
                {groupedItems.extraItems.map((item) => (
                  <article className="result-card" key={`${item.taskId}-${item.decisionRank}`}>
                    <strong>{submittedTaskTitles[item.taskId] ?? item.taskId}</strong>
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
                    <p>{item.variant === 'minimum' ? `${submittedTaskTitles[item.taskId] ?? item.taskId} -> ${item.title}` : item.title}</p>
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
              onClick={onConfirm}
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
  );
}
