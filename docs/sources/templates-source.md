# SQL 模板

抄这些，别重写。所有模板都假设会话时区已确认。

## 目录

- [1. cohort 骨架](#1-cohort-骨架)
- [2. 时区换算](#2-时区换算)
- [3. 观测期过滤](#3-观测期过滤)
- [4. 24 小时桶](#4-24-小时桶)
- [5. 留存](#5-留存)
- [6. LTV / 累计付费率](#6-ltv--累计付费率)
- [7. 首充 / 复购](#7-首充--复购)
- [8. GROUPING SETS 合计行](#8-grouping-sets-合计行)
- [9. 样本提示列](#9-样本提示列)
- [10. 分层与漏斗](#10-分层与漏斗)

---

## 1. cohort 骨架

一切查询从这里开始。`min("#event_time")` 顺带处理了重复注册。

```sql
WITH reg AS (
    SELECT
        "#user_id"         AS user_id,
        min("#event_time") AS reg_time,
        max(os)            AS os_raw,
        max("#country")    AS country_raw
    FROM ta.v_event_261
    WHERE "$part_event" = 't_register'
      AND "$part_date" >= '2026-08-24'
    GROUP BY 1
),
cohort AS (
    SELECT
        r.user_id  AS user_id,
        r.reg_time AS reg_time,
        CASE
            WHEN r.os_raw = 'IPhonePlayer' THEN 'A_iOS'
            WHEN r.os_raw = 'Android' AND u.ad_series LIKE '%AEO%' THEN 'B_安卓AEO'
            ELSE '其他'
        END AS grp
    FROM reg r
    LEFT JOIN ta.v_user_261 u ON u."#user_id" = r.user_id
    WHERE lower(r.country_raw) IN ('us','gb')
      AND r.reg_time >= TIMESTAMP '2026-08-28 00:00:00'
),
cohort_f AS (
    SELECT user_id, reg_time, grp
    FROM cohort
    WHERE grp <> '其他'
)
```

**分段筛选改这两行**（做四个看板时）：

| 看板 | country | os |
|---|---|---|
| iOS-US | `= 'us'` | `= 'IPhonePlayer'` |
| iOS-GB | `= 'gb'` | `= 'IPhonePlayer'` |
| and-US | `= 'us'` | `= 'Android'` |
| and-GB | `= 'gb'` | `= 'Android'` |

`ad_series LIKE '%AEO%'` 是临时写法。**跑通后换精确值**——如果有 `nonAEO` 这种命名会被误伤，结论完全反过来。

---

## 2. 时区换算

只影响**自然日标签**和**队列边界**，不影响 24 小时桶。

| 会话时区 | 要北京日 | 要西四日 |
|---|---|---|
| 东八 | 不换算 | `- INTERVAL '12' HOUR` |
| 西四 | `+ INTERVAL '12' HOUR` | 不换算 |

```sql
shifted AS (
    SELECT
        r.user_id,
        r.reg_time,
        r.reg_time - INTERVAL '12' HOUR AS reg_time_w4,   -- 只用于日期标签和边界
        r.os_raw,
        r.country_raw
    FROM reg r
)
```

⚠️ **只平移 `reg_time` 不平移 `event_time`，`date_diff` 会整体偏 12 小时。**所以桶计算必须用原始 `reg_time`。

⚠️ 换算后**不是同一批人**。西四 8/28 = 北京 8/28 12:00 – 8/29 12:00，和东八的 8/28 有一半不重合。

---

## 3. 观测期过滤

**没有这个，持续导量时最新队列会伪造出下降曲线。**

```sql
-- cohort 层：只保留观测期已满的人（看 D0~Dn 需要满 n+1 天）
AND date_diff('second', reg_time, TIMESTAMP '2026-09-03 12:00:00') >= 4 * 86400
```

```sql
-- 宽表层：每个 Dn 单独判断
CASE
    WHEN date_diff('second', p.reg_time, TIMESTAMP '2026-09-03 12:00:00') >= (b.n + 1) * 86400
    THEN 1 ELSE 0
END AS observable
```

加了注册日维度之后，同一行的人观测期一致，整行同进同出，**分母恒定、可以横向读**。

时刻要往后推多少：看 Dn 的 n，需要 `n+1` 天。西四换算后还要再加 12 小时余量。

---

## 4. 24 小时桶

时区无关，所有留存/LTV 统一用这个。

```sql
CAST(date_diff('second', c.reg_time, e."#event_time") / 86400 AS bigint) AS life_day
CAST(date_diff('second', c.reg_time, e."#event_time") / 3600.0 AS DOUBLE) AS hrs
```

自然日切法（只在对齐看板时用）：

```sql
date("#event_time") AS stat_date   -- 不要用 $part_date 当维度
```

---

## 5. 留存

```sql
active AS (
    SELECT DISTINCT
        p.user_id,
        CAST(date_diff('second', p.reg_time, e."#event_time") / 86400 AS bigint) AS n
    FROM payer p
    INNER JOIN ta.v_event_261 e ON e."#user_id" = p.user_id
    WHERE e."$part_event" = 't_login'
      AND e."$part_date" >= '2026-08-24'
      AND e."#event_time" >= p.reg_time
),
agg AS (
    SELECT
        p.reg_date, p.grp,
        count(DISTINCT p.user_id) AS users,
        max(p.reg_time)           AS last_reg,
        count(DISTINCT CASE WHEN a.n = 1 THEN a.user_id END) AS r1,
        count(DISTINCT CASE WHEN a.n = 2 THEN a.user_id END) AS r2
    FROM payer p
    LEFT JOIN active a ON a.user_id = p.user_id
    GROUP BY p.reg_date, p.grp
)
SELECT
    CASE WHEN date_diff('second', last_reg, TIMESTAMP '...') >= 2 * 86400
         THEN CAST(r1 * 100.0 / nullif(users, 0) AS DECIMAL(6,2)) END AS "D1留存%"
FROM agg
```

用 `t_login` 判活跃（覆盖 100%）。**观测期不够的列返回 NULL 而不是 0**，否则分不清"没留存"和"还没到时间"。

不要输出「分母」列——同一行的人观测期一致，分母恒等于队列人数，那列是冗余的。

---

## 6. LTV / 累计付费率

```sql
pay_at AS (
    SELECT
        c.user_id,
        CAST(date_diff('second', c.reg_time, e."#event_time") / 86400 AS bigint) AS n,
        sum(e.cost) AS cent
    FROM cohort_f c
    INNER JOIN ta.v_event_261 e ON e."#user_id" = c.user_id
    WHERE e."$part_event" = 't_pay_flow'
      AND e."$part_date" >= '2026-08-24'
      AND e."#event_time" >= c.reg_time
    GROUP BY 1, 2
),
first_pay AS (
    SELECT user_id, min(n) AS fd FROM pay_at GROUP BY 1
)
```

**累计付费人数不能用窗口累加日付费人数**——同一个人多天付费会被重复计数。做法是先算每人首付日，按首付日累加：

```sql
sum(coalesce(p.new_payers, 0)) OVER (
    PARTITION BY reg_date, grp ORDER BY n
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
) AS cum_payers
```

累计收入可以直接窗口累加。

---

## 7. 首充 / 复购

```sql
ranked AS (
    SELECT
        c.user_id, e.cost AS cent,
        CAST(e.scene_id AS bigint) AS scene_id,
        CAST(e.trade_id AS bigint) AS trade_id,
        row_number() OVER (PARTITION BY c.user_id ORDER BY e."#event_time") AS rn
    FROM cohort_f c
    INNER JOIN ta.v_event_261 e ON e."#user_id" = c.user_id
    WHERE e."$part_event" = 't_pay_flow'
      AND e."$part_date" >= '2026-08-24'
      AND e."#event_time" >= c.reg_time
)
```

- 首充：`WHERE rn = 1`
- 复购：`WHERE rn >= 2`
- 非首日复购：`WHERE rn >= 2 AND life_day >= 1`（两个条件不重复，前者排除首笔、后者排除当日连买）

**首充 ≠ 首日付费**：前者是每人第一笔不管哪天，后者只算注册当天。看板的"首日付费"是后者。

---

## 8. GROUPING SETS 合计行

一次出明细 + 分组小计 + 总计：

```sql
GROUP BY GROUPING SETS ((grp, reg_date), (grp), ())
```

```sql
SELECT
    coalesce(grp, 'Z_合计') AS "分组",
    CASE
        WHEN reg_date IS NULL THEN '全期合计'
        ELSE concat(CAST(month(reg_date) AS varchar), '月',
                    CAST(day(reg_date) AS varchar), '日')
    END AS "注册日"
```

排序用隐藏的日期列，**不要按中文字典序**（「8月9日」会排到「8月25日」前面）：

```sql
ORDER BY coalesce(grp, 'Z_合计'), coalesce(reg_date, DATE '2099-12-31')
```

---

## 9. 样本提示列

```sql
CASE
    WHEN payers >= 30 THEN '可用'
    WHEN payers >= 10 THEN '仅看方向'
    ELSE '样本不足'
END AS "样本提示"
```

分子取该表的**分子事件数**：留存看 `retained_users`，付费看 `payers`，LTV 看 `cum_payers`。

---

## 10. 分层与漏斗

### 金额分层

按**最终累计金额**分档，玩家不会跨档跳：

```sql
CASE
    WHEN c72 <= 500  THEN '1_(0,5]'
    WHEN c72 <  2000 THEN '2_(5,20)'
    WHEN c72 <  5000 THEN '3_[20,50)'
    ELSE                  '4_50以上'
END AS bkt
```

M 值**不要用 `ntile` 分位数**——价格档离散，大量玩家金额完全相同，分位会把两个都花 $9.99 的人分到不同档。用绝对档位，对齐定价结构。

### 阶段漏斗

取每人最高到达阶段，倒序累加得"到达该阶段人数"：

```sql
sum(users_at_stage) OVER (ORDER BY stage DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS reached_users
```

**「卡在该阶段占比%」= 停在此 ÷ 到达此**，这一列的峰值就是卡点。同时输出各阶段付费率，能看出卡点是否阻断了付费。

### 逐笔转化

```sql
lead(users) OVER (ORDER BY seq) AS next_users
```

第 N 笔到第 N+1 笔的转化率。首笔→次笔通常是全链路最低点。

---

## 常见错误速查

| 症状 | 原因 |
|---|---|
| 返回空表 | 观测期截止时刻设得太早，整队列被滤掉 |
| `cannot be resolved` | 事件表的 `country` 要写 `"#country"`；`os` 不要加 `#` |
| 商品名全是 null | 用了 `product_id`（全空），换 `trade_id` |
| 两个查询人数对不上 | 一个用了西四换算、一个没用，队列差 12 小时 |
| 占比加起来不是 100 | GROUPING SETS 的合计行混进了分母 |
| 金额出现 `49.910000000000004` | 先除后加了，改成整数分累加最后转 DECIMAL |
| 留存率某列全是 0 | 观测期未满，应该返回 NULL 而不是 0 |
