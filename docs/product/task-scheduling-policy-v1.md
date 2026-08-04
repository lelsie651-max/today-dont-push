# 任务调度策略 task-scheduling-policy-v1

**这是确定性的工程启发式规则**：相同输入永远得到完全相同的日程，
不读取当前时间、不使用随机数，每一步决策都可以凭 `reasons` / `reasonCodes`
复算出来。它依赖 `energy-policy-v1` 的容量分析结果（调度器内部每次重新
计算容量，不接受外部传入，避免过期数据）。

## 基本假设

- **任务不可拆分**。每个 full / minimum 版本都是一个不可拆分的连续时间块，
  必须完整落在单个空闲槽位内，不允许跨槽位执行。较大的任务应在进入
  调度器之前由用户或上游流程拆分——本轮不实现自动拆分。
- 调度只消费已校验的 `DailyPlanningInput`。

## 任务顺序（稳定排序）

1. `priority`：must → important → optional；
2. 同优先级内，**有 deadline 的任务优先**，deadline 越早越优先；
3. 其余情况保持原输入顺序（稳定排序的最终平局裁决）。

## 版本偏好

| 容量状态 | 能量档位 | 尝试顺序 |
| --- | --- | --- |
| `exhausted_by_commitments` | 任意 | 不安排任何任务，全部延期 |
| `commitment_heavy` | 任意 | minimum → full |
| `available` | 20 | minimum → full |
| `available` | 50 | must：full → minimum；其他：minimum → full |
| `available` | 80 | full → minimum |

任务没有 `minimumVersion` 时只尝试 full。数组内的形态**依次尝试、
先到先得**：首选形态放不下时自动降级到下一个形态。

能量 50 的 must 任务例外地先试 full：还有力气时，真正重要的事
值得趁早做完整版，放不下再降级——"先尽力，再兜底"。

## 放置规则

- 使用容量分析的空闲槽位（planningWindows − commitments），从最早槽位开始；
- 任务放置在其能放入的最早槽位的当前游标处（最早可行位置）；
- 放置成功后推进该槽位游标，后续任务不得与之重叠；
- 任务结束不得晚于 `deadlineAtMs`；
- 已安排总分钟 ≤ `schedulableMinutes`（保护性空白永远不被占用）；
- 已安排总能量 ≤ `remainingEnergyPoints`。

## 结果与原因码

输出含完整的容量快照（`capacity`）、`scheduledItems`（每项带放置窗口、
分钟数、能量成本与安排原因码）、`deferredItems`（每项带尝试过的形态与
延期原因码）、剩余预算，以及 `mustTaskDeferredIds`——被延期的 must 任务
是产品最需要温柔对待的名单。

延期原因码：`CAPACITY_EXHAUSTED`、`INSUFFICIENT_ENERGY`、
`INSUFFICIENT_TOTAL_MINUTES`、`NO_CONTIGUOUS_SLOT`、`DEADLINE_CANNOT_BE_MET`。

安排原因码：`FULL_VERSION_SELECTED`、`MINIMUM_SELECTED_LOW_ENERGY`、
`MINIMUM_SELECTED_COMMITMENT_HEAVY`、`MINIMUM_SELECTED_AS_FALLBACK`。

## 边界与后续

V1 不做：任务自动拆分、跨槽位执行、跨天延期决策、任务间间隔缓冲。
这些都属于后续策略版本；策略常量集中在
`packages/domain/src/capacity/scheduler.ts` 的 `TASK_SCHEDULING_POLICY_V1`，
迭代时以新版本号共存，不静默修改既有行为。
