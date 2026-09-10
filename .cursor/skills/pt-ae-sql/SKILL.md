---
name: pt-ae-sql
description: >-
  PT (piggytycoon, project_id 261) AE/TE ad-hoc SQL fast path with confirmed
  semantics for pay tiers, login, online duration, and D1–D3 lifecycle. Use when
  querying PT/piggytycoon/261 data, writing ae-cli analysis adhoc modelType=sql,
  analyzing 付费/登录/在线时长/生命周期, or accelerating BI取数 by reusing confirmed
 口径 instead of rediscovering tables/events/units.
---

# PT AE SQL 快取

目标：**已确认口径直接用，禁止重复探查**；只对未知指标做最小探测。

与 `ae-analysis` 配合：项目门禁、adhoc SQL 执行仍走 ae-cli；本 skill 提供 PT 的已验证语义与加速流程。

## 快路径（默认）

1. `project_id = 261`（piggytycoon / PT）。不要再 `project info list` 猜项目。
2. 表直接用：
   - 用户：`hive.ta.v_user_261`
   - 事件：`hive.ta.v_event_261`
3. 事件表必须带 `"$part_date"` 分区条件。
4. 直接写 `ae-cli analysis adhoc run --project-id 261 --model-type sql`。
5. **不要**为付费/登录/在线再跑：sql-table list、事件名模糊搜索、`pay_amt` 量纲探测、`online_time` 累计 vs 会话探测——除非用户明确质疑口径或结果自相矛盾。

## 已确认口径（2026-09-10 验证）

### 付费

| 项 | 口径 |
|---|---|
| 字段 | `v_user_261.pay_amt` |
| 单位 | **美分**；美元 = `pay_amt / 100.0` |
| 证据 | 付费用户 min≈99、常见 199/299，符合 $0.99/$1.99/$2.99 |
| 默认分档 | 不付费：`COALESCE(pay_amt,0)=0`；0–5：`(0,5]`；5–20：`(5,20]`；20–50：`(20,50]`；50+：`>50`（美元） |

```sql
CASE
  WHEN COALESCE(pay_amt, 0) = 0 THEN '1_非付费'
  WHEN pay_amt / 100.0 > 0 AND pay_amt / 100.0 <= 5 THEN '2_0-5'
  WHEN pay_amt / 100.0 > 5 AND pay_amt / 100.0 <= 20 THEN '3_5-20'
  WHEN pay_amt / 100.0 > 20 AND pay_amt / 100.0 <= 50 THEN '4_20-50'
  ELSE '5_50+'
END AS pay_bucket
```

注意：用**当前累计付费**切档做 D1–D3 会有后视偏差；若用户要「当日已付费切档」，另写按日累计逻辑，勿默默替换。

### 登录

- 事件：`t_login`（`"$part_event" = 't_login'`）
- 指标：次数 = `count(*)` / `count_if(event_name='t_login')`
- 相关但默认不用：`t_before_login_step`（步骤埋点，不是登录次数）

### 在线时长

| 项 | 口径 |
|---|---|
| 事件 | `t_online_time` |
| 字段 | `online_time` |
| 语义 | **单次会话时长（秒）**，非累计（属性注释写「累计」但实际值会上下波动） |
| 汇总 | `sum(online_time)`；展示常用 `/ 60.0` → 分钟 |
| 无活跃 | 记 `0`（做人均时把未活跃用户算进分母） |
| 慎用 | `v_user_261.online_time_total` 有极端异常值，默认不用 |
| 相关 | `t_online.online` 是另一套心跳字段，默认不用作会话时长 |

### 生命周期 D1/D2/D3

- D1 = 注册当天，D2 = 次日，D3 = 第 3 天
- `life_day = date_diff('day', date(reg_time), date(event_time)) + 1`
- 注册时间：优先 `"#reg_time"`，否则 `register_time`
- 完整 D1–D3 cohort：注册日截止到「今天 − 3 天」；事件窗覆盖到 D3

### 时区

- 该项目 adhoc 常见 `effective_zone_offset = -4`
- 未指定时用项目默认；对比历史结果时核对 offset

## Windows 执行（加速要点）

PowerShell 会剥掉 JSON 引号。用 **node 调 ae-cli.js + 临时脚本**，不要直接在 pwsh 里拼 `--queries`/`--definition`：

```javascript
// %TEMP%/ae_sql_run.js
const { spawnSync } = require("child_process");
const cli = "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\@thinkingai\\ae-cli\\bin\\ae-cli.js";
const def = JSON.stringify({ sql: `...` });
const r = spawnSync(process.execPath, [
  cli, "analysis", "adhoc", "run",
  "--project-id", "261",
  "--model-type", "sql",
  "--definition", def,
  "--preview-rows", "100",
  "--timeout-seconds", "180",
  "--format", "json",
], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
process.stdout.write(r.stdout || "");
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status || 0);
```

并行：彼此独立的 SQL 用多个脚本并行跑；有依赖的串行。

## 最小探测（仅未知时）

只在下列情况探测，且**一次探一个假设**：

- 新事件/新指标名未知 → 对 `v_event_261` 按 `"$part_date"` + `lower("$part_event") LIKE ...` 聚合 top 事件
- 新数值字段量纲未知 → `min/p50/p90/max` + 样例 20 行（看是否单调累计）
- 结果与业务常识冲突 → 复检单位/事件/分母，再改 skill

探测成功后：**立刻写回本 skill「已确认口径」**，下次直接用。

## 回答要求

- 开头给结论；标明时间窗、分档、事件、单位
- 明确写出沿用了本 skill 的哪些口径
- 若偏离本 skill（用户当场要求），标注为「非默认口径」

## 维护

新确认、纠错、废弃口径都更新本文件；保持精简，只留可执行事实。
