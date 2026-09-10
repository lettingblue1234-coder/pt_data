# PiggyTycoon 数据取数交接文档

> 重建版。整合 2026-07-27 的《工作流总结》与 8 月分析过程中新增的规范。
> 用途：交接给接手取数的人，或者自己隔一段时间回来时快速恢复上下文。

---

## 一、环境事实（不要再重新踩一遍）

| # | 事实 | 说明 |
|---|---|---|
| 1 | **SQL 引擎是 Presto / Trino，不是 ClickHouse** | 反引号会报 `backquoted identifiers are not supported`。字段名用双引号包；用 `date()` / `date_diff()` / `COUNT(DISTINCT)` / `UNNEST(ARRAY[...])` 这类标准写法，不要用 `toDate` / `dateDiff` |
| 2 | **编辑器不支持行尾注释** | `FROM xxx  -- 注释` 会报错。注释必须独占一行，实践上干脆全部不写注释、别名用英文 |
| 3 | **所有事件在同一张宽表 `v_event_261` 里** | 不是「一个事件一张表」。用 `"$part_event"` 区分事件类型（`t_register` / `t_pay_flow` / `t_slot` …），用 `"$part_date"` 按天分区 |
| 4 | **用户属性表是独立的 `ta.v_user_261`** | 一账号一行的当前属性快照（等级 / 金币 / 累计付费等）。同库里的 `user_result_cluster_261`（标签分群）、`user_day_serial_261`（每日镜像）不是这个用途 |
| 5 | **显示名 ≠ 真实字段名** | 后台属性列表里的 `ta_name` 列才是物理字段名 |
| 6 | **部分查询工具会吃掉首字母** | 提交前确认第一个词是 `SELECT` 而不是 `ELECT` |

### 字段名踩坑清单

- 显示名 `country` → 真实字段是 `#country`（预置属性）。直接写 `country` 报 `Column 'country' cannot be resolved`
- 显示名 `fn_uid`（发行账号ID）→ 真实字段就是 `#account_id`，不是独立列
- `t_pay_flow` 事件下**没有 `#country_code`**，只有 `#country`
- 地块字段拼写是 **`polt_id`**，不是 `plot_id`

**遇到「字段不存在」，第一反应是去后台属性列表查 `ta_name`，不要猜。**

---

## 二、取数通用约定

每一条都对应过一次实际返工。

| # | 约定 | 原因 |
|---|---|---|
| 1 | **主查询零 JOIN**，人群过滤用 `IN` 半连接 | JOIN `t_register` 会因重复注册记录放大行数（有 9 个账号 `reg_event_cnt = 2`） |
| 2 | **JOIN `ta.v_user_261` 是安全的** | 该表一账号一行。需要 `register_time` 算时间窗口时必须走 JOIN |
| 3 | **必带 `$part_date` 分区过滤** | 否则全表扫描，巨慢甚至直接报错 |
| 4 | **窗口跨日时 `$part_date` 上界放宽一天** | 23:57 注册的人，24 小时窗口会跨到次日 |
| 5 | **数值型 ID 是 double** | `user_action` / `trade_id` / `scene_id` / `page_id`。比较时不加引号；要和字符串 `coalesce` 需 `CAST(CAST(x AS bigint) AS varchar)` |
| 6 | **不要用服务端算好的派生字段** | `total_pay_cnt` 曾经是算在 JOIN 放大后的数据上的，把 4 笔记成了 8 笔。序号、总数、是否首次这类一律拿回本地算 |
| 7 | **先跑字段探查，再取明细** | `point_change_cnt` 全空、`trigger_time` 写死、`t_slot.power_*` 全为 0，都是探查阶段发现的 |
| 8 | **宁可多取几列，少跑几轮** | 取明细时把 `curr_power` / `curr_coin` / `curr_area_id` 这类公共字段一并带上。曾因漏取 `curr_power` 白跑一轮 |
| 9 | **能在 SQL 里聚合就不要拉明细回本地** | 减少来回，也减少中途出错的环节 |
| 10 | **金额先按整数分聚合，最后转定点数；比率一律加 `nullif`** | 见下节 |

### 数值精度规范

根因：在 CTE 里写 `cost / 100.0 AS usd` 先转浮点美元、再 `sum()` 几十个浮点数，误差会累积。`49.910000000000004` 就是 `9.98 + 39.93` 在二进制浮点下的结果。

```sql
-- ✗ 差：先除后加，误差累积
sum(cost / 100.0) AS revenue

-- △ 中：整数相加，但结果仍是 DOUBLE
round(sum(cost) / 100.0, 2) AS revenue

-- ✓ 好：整数相加（精确）+ 定点数输出
CAST(sum(cost) / 100.0 AS DECIMAL(12,2)) AS revenue
```

| 字段类型 | 写法 | 精度 |
|---|---|---|
| 金额、收入 | `CAST(sum(cost) / 100.0 AS DECIMAL(12,2))` | 2 位 |
| 客单、人均付费 | `CAST(sum(cost) / 100.0 / nullif(n, 0) AS DECIMAL(10,2))` | 2 位 |
| **ARPU** | `CAST(sum(cost) / 100.0 / nullif(n, 0) AS DECIMAL(10,4))` | **4 位** |
| 比率、百分比 | `CAST(a * 100.0 / nullif(b, 0) AS DECIMAL(6,2))` | 2 位（已 ×100） |
| 倍数、笔数均值 | `CAST(a * 1.0 / nullif(b, 0) AS DECIMAL(8,2))` | 2 位 |
| 小时数 | `CAST(date_diff('second', a, b) / 3600.0 AS DECIMAL(10,2))` | 2 位 |
| 计数 | 保持 `bigint`，不转 | — |

ARPU 单独用 4 位：量级在 \$0.1~\$0.5，两位小数会把 \$0.267 和 \$0.190 的差异压掉。

配套两条：CTE 里金额保持整数分（`cost AS cent`），只在最终 SELECT 转一次；分层阈值也用分（`total_cent < 200` 而不是 `total_usd < 2`），整数比较没有边界误差。

---

## 三、人群模板

所有查询共用这一段，改日期即可切换队列。

```sql
-- 方式一：IN 半连接（主查询不需要 register_time 时用）
AND "#account_id" IN (
      SELECT "#account_id" FROM ta.v_user_261
      WHERE lower(country) IN ('us','gb')
        AND register_time >= TIMESTAMP '2026-07-21 00:00:00'
        AND register_time <  TIMESTAMP '2026-07-22 00:00:00'
    )

-- 方式二：CTE + JOIN（需要 register_time 算时间窗口时用）
WITH cohort AS (
    SELECT "#account_id" AS aid, register_time
    FROM ta.v_user_261
    WHERE lower(country) IN ('us','gb')
      AND register_time >= TIMESTAMP '2026-07-21 00:00:00'
      AND register_time <  TIMESTAMP '2026-07-22 00:00:00'
)
```

上界用 `< 07-22 00:00:00` 而不是 `<= 07-21 23:59:59`，避免漏掉 `23:59:59.xxx` 的毫秒尾数。

| 队列 | 日期范围 | 人数 | 用途 |
|---|---|---|---|
| 单日队列 | 07-21 ~ 07-22 | 758 | 新手 / 玩法分析，观测期最长 |
| 三日队列 | 07-21 ~ 07-24 | 2,346 | 需要 144 小时留存时用 |
| 全买量队列 | 07-21 起 | 2,965 | 付费分析（us 1,628 / gb 1,337，全 iOS） |

**口径演变提醒**：起点日期中间反复改过 7.20 / 7.21 / 7.22，最终定在 **7.21 00:00**。任何文件名或内容里出现 7.20 / 7.22 的旧版本都视为过时。

---

## 四、事件表规模速查

（基于单日队列 758 人的探查结果）

| 事件 | 行数 | 人数 | 关键字段 |
|---|---|---|---|
| `t_user_track` | 74,315 | 557 | scene_id, page_id, user_action, trigger_time |
| `t_goods_flow` | 65,854 | 579 | 待探查（盾 / 炮 / 积分应在此） |
| `t_build` | 63,598 | 611 | area_id, **polt_id**, build_opr, coin_cnt |
| `t_before_login_step` | 24,958 | **756** | login_step |
| `t_pay_step` | 24,291 | 419 | step_type, order_id, cost |
| `t_point_race` | 22,537 | 563 | point_cnt, point_stage_before/after（`point_change_cnt` **全空**） |
| `t_novice_step` | 21,350 | 733 | novice_step, group_id（`curr_*` 全空） |
| `t_slot_cannon` | 4,217 | 526 | opp_uid, opp_area_id（`coin_cnt` **全空**） |
| `t_login` | 4,099 | **758** | curr_coin, curr_power |
| `t_logout` | 4,048 | 752 | **`curr_lvl` 只有这里有值** |
| `t_slot_steal` | 2,358 | 621 | opp_uid, is_gold, coin_cnt |
| `t_slot` | — | — | bet, coin_cnt, slot_event_id（`power_before/after` **全为 0**） |
| `t_pay_flow` | 70 | 18 | trade_id, cost, scene_id, curr_power, curr_coin |

两个实用提示：判留存用 `t_login`（覆盖 100%）；分析等级必须从 `t_logout` 取。

一个已知缺陷：`t_pay_flow` 约 31% 的订单状态快照缺失（`curr_coin = 0` 且 `curr_area_id = 0`），做资源类分析前需要先剔除。

---

## 五、方法论备忘（分析阶段的坑）

| # | 原则 | 踩坑实例 |
|---|---|---|
| 1 | **必须有对照组** | 「体力耗尽导致流失」看似铁证（A 组 54% 归零），加入 Core 组后立即证伪——Core 也 43% 归零但流失率仅 16% |
| 2 | **对随位置变化的群体不可做差分** | 用累计中位数做 `diff(5)` 算出「累计产出为负」，是伪影——每个位置的人群不同 |
| 3 | **分箱必须做宽度稳健性检验** | A 组边界换 15 / 20 宽度就漂移，B 组不漂移，结论强度不同 |
| 4 | **看全部数据点** | 「产出崩塌 8.4 倍」是只挑倒数第 10/8/6/4/2/1 造成的，补上奇数位置就没了 |
| 5 | **中位数 ÷ 中位数 ≠ 逐人比值的中位数** | 金币倍数从 2,027 修正到 561 |
| 6 | **均值受极值主导时看中位** | 一次 50,000 的大奖能把某位置均值拉高 8 倍 |
| 7 | **相关性显著 ≠ 因果成立** | 付费面板与流失 p = 0.0064，但 231 条全是曝光、无人点击 |
| 8 | **字段名不等于业务含义** | `coin_cnt = 0` 数据上正确，解读成「什么都没得到」是臆测——实际给的是积分 / 盾 / 炮 / 体力 |
| 9 | **枚举先行** | 累计撤回过 6 条结论，全部因为拿到数据时不知道字段含义（`user_action=1` 实为「点击 icon」而非曝光；`page_id` 是场景内局部编号而非全局唯一） |

---

## 六、仍待确认 / 待办

1. **缺枚举表**（卡住最多结论）：`build_opr`、`novice_step`、`step_type`、`slot_event_id`、`group_id`、`SCENE_TYPE` 的 REASON 部分。其中 `group_id` 若是 AB 分组，新手流失曲线需要按组重算
2. `#event_time` 是否做过时区转换未最终确认，日期边界（如 7.21 凌晨）理论上仍可能有误差
3. `t_pay_flow` 的 `scene_id` 是数字编码，没有对照表时导出结果只能看到数字
4. 早期「独立表假设」写的那批 SQL（BET 差异分析、bet_analysis 系列）需要按 `v_event_261` 结构重写才能跑通

---

## 七、给接手人的三句话

1. 先看第一节的六条环境事实，能省掉两天试错
2. 取数前先跑一遍字段探查（不限 `$part_event`、按事件名分组、每列用 `count()`），确认字段挂在哪个事件、有没有值，再写正式查询
3. 拿到数据不要急着下结论——第五节那九条，每条都是已经错过一次的
