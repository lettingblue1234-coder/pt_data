# AE CLI 执行（Windows）与 skill 分工

## 与 `pt-ae-sql` 的分工

| Skill | 用途 |
|---|---|
| **`piggytycoon-sql`（本 skill）** | 看板 SQL / 留存 LTV 漏斗 / 枚举口径 / 分析纪律；面向数数查询页或导出 SQL |
| **`pt-ae-sql`** | `ae-cli analysis adhoc` 快取：付费档、登录、在线时长、**生命周期 D1–D3**（见下方命名差异） |

深分析默认读本 skill；只跑 adhoc 快指标时用 `pt-ae-sql`。

## ⚠️ 生命周期 / 留存命名（两套并存，勿混）

| 语境 | D1 含义 | 来源 |
|---|---|---|
| **留存/LTV 看板（本 skill）** | 次日（24–48h），第 N 日 = D(N−1) | 业务留存表 |
| **`pt-ae-sql` 生命周期** | **注册当天**，`life_day = date_diff + 1` | AE 快取 |

留存「七日」= D6；LTV7 = D7。两张表并排放时先核命名。

## Windows 跑 ae-cli

PowerShell 会剥掉 JSON 引号。用 node 调 `ae-cli.js` + 临时脚本，不要直接在 pwsh 拼 `--definition`：

```javascript
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

表：`hive.ta.v_user_261` / `hive.ta.v_event_261`；事件表必带 `"$part_date"`。
adhoc 常见 `effective_zone_offset = -4`。

## 付费金额（adhoc 用户表）

`v_user_261.pay_amt` 单位是**美分**；美元 = `pay_amt / 100.0`。
事件流水 `t_pay_flow.cost` 同样按整数分累加后再转 DECIMAL（见本 skill 主文）。
