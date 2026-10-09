WITH reg AS (
    SELECT
        "#user_id"         AS user_id,
        min("#event_time") AS reg_time,
        max(os)            AS os_raw,
        max("#country")    AS country_raw
    FROM ta.v_event_261
    WHERE "$part_event" = 't_register'
      AND "$part_date" >= '2026-08-27'
    GROUP BY 1
),
cohort AS (
    SELECT
        user_id,
        reg_time,
        CASE
            WHEN os_raw = 'Android'      THEN '安卓'
            WHEN os_raw = 'IPhonePlayer' THEN '苹果'
            ELSE '其他'
        END AS os_name
    FROM reg
    WHERE lower(country_raw) IN ('us', 'gb')
      AND reg_time >= TIMESTAMP '2026-08-28 00:00:00'
      AND date_diff('second', reg_time, TIMESTAMP '2026-10-09 00:00:00') >= 86400
),
cohort_f AS (
    SELECT user_id, reg_time, os_name FROM cohort WHERE os_name <> '其他'
),
d0_pay AS (
    SELECT
        c.user_id,
        c.os_name,
        CAST(e.scene_id AS bigint) AS scene_id,
        e.cost                     AS cent,
        row_number() OVER (PARTITION BY c.user_id ORDER BY e."#event_time") AS rn
    FROM cohort_f c
    INNER JOIN ta.v_event_261 e ON e."#user_id" = c.user_id
    WHERE e."$part_event" = 't_pay_flow'
      AND e."$part_date" >= '2026-08-27'
      AND e."#event_time" >= c.reg_time
      AND date_diff('second', c.reg_time, e."#event_time") < 86400
),
users AS (
    SELECT os_name, count(*) AS n_users FROM cohort_f GROUP BY 1
),
scene_map (scene_id, scene_name) AS (
    VALUES
        (1, '阶梯_三段式礼包'), (2, 'N合一_三合一礼包'), (3, '行为_爬塔礼包'),
        (4, '阶梯解锁_五加一礼包'), (7, '阶梯_一段式礼包'), (8, '阶梯_轮播礼包'),
        (9, '商城_常驻礼包'), (10001, '商城'), (10005, '爬塔活动'),
        (10027, '三日新手礼活动'), (10028, '伐木车爬塔活动'), (10033, '付费副阶梯活动')
),
agg AS (
    SELECT
        p.os_name,
        p.scene_id,
        count(*)                                        AS orders,
        count(DISTINCT p.user_id)                       AS payers,
        count(DISTINCT CASE WHEN p.rn = 1 THEN p.user_id END) AS first_payers,
        count(DISTINCT CASE WHEN p.rn = 2 THEN p.user_id END) AS second_payers,
        sum(p.cent)                                     AS cent
    FROM d0_pay p
    GROUP BY 1, 2
)
SELECT
    a.os_name                                                AS "系统",
    coalesce(m.scene_name, concat('未知场景_', CAST(a.scene_id AS varchar))) AS "场景",
    a.orders                                                 AS "首日订单",
    a.payers                                                 AS "首日付费人数",
    a.first_payers                                           AS "首笔落在此场景",
    a.second_payers                                          AS "第二笔落在此场景",
    CAST(a.cent / 100.0 AS DECIMAL(12, 2))                   AS "首日收入$",
    CAST(a.payers * 100.0 / nullif(u.n_users, 0) AS DECIMAL(6, 2)) AS "付费率%"
FROM agg a
LEFT JOIN scene_map m ON m.scene_id = a.scene_id
LEFT JOIN users u ON u.os_name = a.os_name
ORDER BY a.os_name, a.cent DESC
