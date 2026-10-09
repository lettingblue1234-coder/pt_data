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
cohort_f AS (
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
      AND os_raw IN ('Android', 'IPhonePlayer')
),
d0_pay AS (
    SELECT
        c.user_id,
        c.os_name,
        e.cost AS cent,
        date_diff('second', c.reg_time, e."#event_time") / 60.0 AS mins,
        row_number() OVER (PARTITION BY c.user_id ORDER BY e."#event_time") AS rn
    FROM cohort_f c
    INNER JOIN ta.v_event_261 e ON e."#user_id" = c.user_id
    WHERE e."$part_event" = 't_pay_flow'
      AND e."$part_date" >= '2026-08-27'
      AND e."#event_time" >= c.reg_time
      AND date_diff('second', c.reg_time, e."#event_time") < 86400
),
per_user AS (
    SELECT
        user_id,
        os_name,
        max(CASE WHEN rn = 1 THEN cent END) AS first_cent,
        max(CASE WHEN rn = 1 THEN mins END) AS first_mins,
        max(CASE WHEN rn = 2 THEN mins END) AS second_mins,
        count(*)                            AS n_orders,
        sum(cent)                           AS total_cent
    FROM d0_pay
    GROUP BY 1, 2
),
tiered AS (
    SELECT
        *,
        CASE
            WHEN first_cent <= 99  THEN '1_$0.99'
            WHEN first_cent <= 199 THEN '2_$1.99'
            WHEN first_cent <= 299 THEN '3_$2.99'
            WHEN first_cent <= 499 THEN '4_$3.99-4.99'
            ELSE '5_$5+'
        END AS price_tier
    FROM per_user
)
SELECT
    os_name                                                         AS "系统",
    coalesce(price_tier, '0_合计')                                   AS "首笔价位",
    count(*)                                                        AS "首日付费人数",
    count_if(n_orders >= 2)                                         AS "首日有第二笔",
    CAST(count_if(n_orders >= 2) * 100.0 / nullif(count(*), 0) AS DECIMAL(6, 2)) AS "首日二充率%",
    CAST(count_if(n_orders >= 3) * 100.0 / nullif(count(*), 0) AS DECIMAL(6, 2)) AS "首日三充率%",
    CAST(approx_percentile(first_mins, 0.5) AS DECIMAL(10, 1))      AS "首笔距注册分钟P50",
    CAST(approx_percentile(second_mins - first_mins, 0.5) AS DECIMAL(10, 1)) AS "首到二间隔分钟P50",
    CAST(sum(total_cent) / 100.0 / nullif(count(*), 0) AS DECIMAL(10, 2)) AS "首日ARPPU$"
FROM tiered
GROUP BY GROUPING SETS ((os_name, price_tier), (os_name))
ORDER BY os_name, coalesce(price_tier, '0_合计')
