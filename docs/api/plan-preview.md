# 每日计划预览 API

`POST /v1/plans/preview`

对给定的签到、可用时间窗、固定承诺与任务清单执行一次**无副作用**的每日调度预演，返回完整的 `DailySchedule`（容量分析 + 已安排项 + 推迟项）。不写数据库、不调用外部服务、相同请求的响应完全一致。

- Fastify `bodyLimit`：256 KB（超过返回 Fastify 默认 413）。
- 请求体为 JSON，所有对象均为 strict（未知字段拒绝）。

## 请求

```jsonc
{
  "id": "plan-1",
  "localDate": "2026-08-04",
  "timeZone": "Asia/Shanghai",
  "checkIn": {
    "id": "checkin-1",
    "energyLevel": 80,          // 任意整数；是否为 20/50/80 由 domain 判定
    "strainTags": ["poor_sleep"] // ≤ 8 个字符串
  },
  "planningWindows": [           // ≤ 16 个
    { "startAtMs": 1800000000000, "endAtMs": 1800014400000 }
  ],
  "commitments": [               // ≤ 64 个
    {
      "id": "c-1",
      "title": "站会",
      "window": { "startAtMs": 1800003600000, "endAtMs": 1800005400000 },
      "energyDemand": 1
    }
  ],
  "tasks": [                     // ≤ 100 个
    {
      "id": "task-1",
      "title": "写周报",
      "priority": "must",        // must / important / optional，由 domain 判定
      "estimatedMinutes": 60,
      "energyDemand": 2,
      "emotionalResistance": 0,
      "minimumVersion": {        // 可选，must 任务的保底版本
        "title": "写个开头",
        "estimatedMinutes": 15,
        "energyDemand": 1
      }
    }
  ]
}
```

### 安全上限（contracts 层负责）

| 约束 | 上限 | 超限结果 |
| --- | --- | --- |
| `planningWindows` 数量 | 16 | 400 |
| `commitments` 数量 | 64 | 400 |
| `tasks` 数量 | 100 | 400 |
| `strainTags` 数量 | 8 | 400 |
| 字符串长度（id/title/note/date/timeZone） | 200 / 500 / 1000 / 16 / 128 | 400 |
| 请求体字节数 | 256 KB | 413 |

Request Schema 只负责 JSON 结构与安全上限，**不重复领域业务规则**：`energyLevel` 接受任意整数、`priority` 接受任意非空字符串、空数组是否合法、窗口是否重叠等一律交由 domain 判定（返回 422）。

`strainTags` 的合法领域值为 `poor_sleep`、`physical_discomfort`、`low_mood`、`exhausting_commute`、`meeting_heavy`、`urgent_deadline`、`interpersonal_stress`、`other`。其中 `other` 属于领域规则：一旦出现，`checkIn.note` 必填；contracts 只校验它们是字符串数组，不在传输层重复该业务约束。

## 响应

三类响应均由 contracts 的 Zod schema 完整描述，错误条目统一为 `{ code, path, message }`。`path` 使用 `tasks[0].title` 风格（数组段为 `[索引]`，对象段为 `.字段`）。

### 200 `{ status: 'ok', data: DailySchedule }`

```jsonc
{
  "status": "ok",
  "data": {
    "policyVersion": "task-scheduling-policy-v1",
    "energyPolicyVersion": "energy-policy-v1",
    "capacity": { /* 容量分析：总时长、保护性空白、能量预算、capacityState、reasons */ },
    "scheduledItems": [
      {
        "taskId": "task-1",
        "title": "写周报",
        "priority": "must",
        "variant": "full",
        "window": { "startAtMs": 1800000000000, "endAtMs": 1800003600000 },
        "minutes": 60,
        "energyCostPoints": 4,
        "reasonCodes": ["FULL_VERSION_SELECTED"],
        "decisionRank": 0
      }
    ],
    "deferredItems": [
      {
        "taskId": "task-2",
        "priority": "optional",
        "attemptedVariants": ["full"],
        "reasons": [{ "code": "INSUFFICIENT_TOTAL_MINUTES", "message": "…", "values": { /* 数值字典 */ } }],
        "reasonCodes": ["INSUFFICIENT_TOTAL_MINUTES"]
      }
    ],
    "remainingSchedulableMinutes": 155,
    "remainingEnergyPoints": 76,
    "mustTaskDeferredIds": []
  }
}
```

### 400 `{ status: 'invalid_request', errors: [...] }`

请求的 **JSON 结构或安全上限**不满足 contracts：缺字段、未知字段、类型错误、数量超限等。`errors[].code` 为 Zod issue code（如 `invalid_type`、`too_big`）。

```jsonc
{
  "status": "invalid_request",
  "errors": [{ "code": "invalid_type", "path": "localDate", "message": "Invalid input: expected string, received undefined" }]
}
```

### 422 `{ status: 'invalid_input', errors: [...] }`

结构合法但**领域规则**不满足（由 domain 聚合输出，可能一次返回多个错误）：`INVALID_ENERGY_LEVEL`、`OVERLAPPING_PLANNING_WINDOWS`、`EMPTY_PLANNING_WINDOWS`、`INVALID_PRIORITY` 等。`path` 精确到具体字段或数组元素（如 `planningWindows[1]`、`tasks[0].estimatedMinutes`）。

```jsonc
{
  "status": "invalid_input",
  "errors": [{ "code": "INVALID_ENERGY_LEVEL", "path": "checkIn.energyLevel", "message": "energyLevel 必须为 20 / 50 / 80 之一" }]
}
```

## 分层职责

| 层 | 职责 | 禁止 |
| --- | --- | --- |
| contracts | Zod 请求/响应契约、JSON 结构与安全上限、错误条目形状 | 依赖 domain，重复业务规则 |
| apps/api | 路由与状态码映射（400/422/200）、Zod path 转 `tasks[0].title` 字符串 | 直接调用 domain，复制调度/领域校验逻辑 |
| application | 用例 `previewDailyPlan(command)`：组装 domain 输入、透传结构化 DomainError | 依赖 contracts，读取时间/环境变量/外部服务 |
| domain | 业务规则校验、容量分析、调度算法 | 依赖任何内部包或第三方库 |

请求处理顺序：contracts safeParse（失败 → 400）→ application 用例（领域错误 → 422，原样透传 `{code,path,message}`）→ 成功 → 200。
