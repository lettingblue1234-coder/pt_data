"""
积分事件卡点/节点系统 —— 核心公式的可执行实现。

设计意图：另一个能访问线上配置表/玩家数据的Agent，把拉下来的配置表整理成本文件约定的
简单数据结构（list of dict，字段名与配置表列名一致），传入下面的函数即可得到期望值，
不需要手工重新推导公式（公式细节多，容易算错）。

⚠️ 本文件里的 `lookup_tiered` 实现了 references/points-race-checkpoint.md 里标注为
"未经产品文档正面确认"的阶梯查表规则（取 <= 指标的最大档）。如果线上验证发现这条规则不对，
只需要改这一个函数，其余函数不用动。

用 `python checkpoint_calc.py` 直接运行文件末尾的 worked example，
会打印出与 references/points-race-checkpoint.md 第9节完全一致的结果，可用来快速验证
本文件的实现是否正确。
"""

import math
from bisect import bisect_right


def lookup_tiered(rows, indicator_field, value_field, indicator):
    """
    阶梯查找：给定按indicator_field升序排列的rows，返回 <= indicator 的最大那一档对应的value_field。

    rows: list[dict]，例如 PointsRaceNodeA 里某个CheckpointGroupID下的所有行
    indicator_field: 用来比较的字段名，如 'Indicator'
    value_field: 要取出的字段名，如 'NodeA'；如果该档对应多个字段（如NodeBRange的Lower/Upper），
                 传 None，函数改为返回整行dict

    ⚠️ 未经产品文档正面确认的假设，见文件顶部说明。
    """
    sorted_rows = sorted(rows, key=lambda r: r[indicator_field])
    indicators = [r[indicator_field] for r in sorted_rows]
    idx = bisect_right(indicators, indicator) - 1
    if idx < 0:
        idx = 0  # 指标小于最小档时，兜底取最小档，具体是否应报错待确认
    row = sorted_rows[idx]
    return row if value_field is None else row[value_field]


def compute_node_a(current_energy, k, equity_coef, node_a_global_coef, node_a_rows):
    """
    node_a_rows: PointsRaceNodeA 里该CheckpointGroupID下的所有行，
                 每行需含 'Indicator' 和 'NodeA' 字段
    返回：节点a（单位=第几个大节点）
    """
    indicator = (current_energy + k) * equity_coef * node_a_global_coef
    return lookup_tiered(node_a_rows, 'Indicator', 'NodeA', indicator)


def sum_energy_reward_to_node(stage_rows, node_index):
    """
    累加 PointsRaceStage 里 IsBigNode=1 的行，从第1个大节点累加到第node_index个大节点的
    体力奖励(ItemID=2001的ItemDelta)。

    stage_rows: 某个StageGroupID下的全部行(按StageID升序)，每行需含
                'StageID', 'IsBigNode', 各Rewards#N.ItemID / Rewards#N.ItemDelta 字段
                （字段名可根据实际拉取格式调整，这里假设已经预处理成
                'BigNodeIndex' 和 'EnergyReward' 两个字段更省事，见下方注释）
    node_index: 节点a或节点b的"第几个大节点"编号

    建议在拉取PointsRaceStage后，先做一次预处理：给IsBigNode=1的行按顺序编号成
    BigNodeIndex=1,2,3...，并从Rewards里挑出ItemID=2001对应的ItemDelta存成EnergyReward，
    这样这个函数直接用预处理后的字段就行，避免每次都重新解析Rewards#1/#2/#3三组字段。
    """
    big_nodes = sorted(
        (r for r in stage_rows if r.get('IsBigNode') == 1),
        key=lambda r: r['StageID']
    )
    total = 0
    for i, row in enumerate(big_nodes, start=1):
        if i > node_index:
            break
        total += row.get('EnergyReward', 0)
    return total


def compute_node_b_range(current_energy, energy_reward_to_a, equity_coef, node_b_global_coef,
                          node_a, node_b_range_rows, gap_min, gap_max):
    """
    node_b_range_rows: PointsRaceNodeBRange 里该CheckpointGroupID下的所有行，
                        每行需含 'Indicator', 'Lower', 'Upper'
    返回: (b_low, b_high)，单位=第几个大节点
    """
    indicator = (current_energy + energy_reward_to_a) * equity_coef * node_b_global_coef
    row = lookup_tiered(node_b_range_rows, 'Indicator', None, indicator)
    b_low, b_high = row['Lower'], row['Upper']

    # 夹取跨度
    b_low = max(node_a + gap_min, min(node_a + gap_max, b_low))
    b_high = max(node_a + gap_min, min(node_a + gap_max, b_high))
    return b_low, b_high


def update_node_b(current_b, b_low, b_high, ratio_indicator, node_b_update_rows):
    """
    ratio_indicator: (当前体力+当前节点到a奖励和) / (开启时体力+节点1~a奖励和)，
                     万分位表示（0~100000+），若已超过节点a则只用当前体力
    node_b_update_rows: PointsRaceNodeBUpdate 里的所有行，每行需含 'Indicator', 'Coef'
                        （Coef为万分位，如-5000表示-50%，+10000表示+100%）
    返回: 新的节点b坐标
    """
    coef = lookup_tiered(node_b_update_rows, 'Indicator', 'Coef', ratio_indicator) / 10000
    delta = math.ceil(coef * (b_high - b_low))
    new_b = current_b + delta
    return max(b_low, min(b_high, new_b))


def compute_suppression_coef(progress_pct, bet_ratio, trans_pct,
                              progress_coef_rows, bet_coef_rows, trans_index_coef_rows):
    """
    三个rows分别是 PointsRaceProgressCoef / PointsRaceBetCoef / PointsRaceTransIndexCoef
    里该CheckpointGroupID下的所有行，字段分别是('ProgressPct','ProbCoef')/
    ('BetRatio','ProbCoef')/('TransPct','ProbCoef')

    返回：概率压制系数（万分位换算成小数后的结果）
    """
    p = lookup_tiered(progress_coef_rows, 'ProgressPct', 'ProbCoef', progress_pct) / 10000
    b = lookup_tiered(bet_coef_rows, 'BetRatio', 'ProbCoef', bet_ratio) / 10000
    t = lookup_tiered(trans_index_coef_rows, 'TransPct', 'ProbCoef', trans_pct) / 10000
    return p * b / t


def compute_pay_pool_increment(current_pay, avg_pay, premium_coef_rows, pay_amount_coef,
                                energy_usd_value):
    """
    premium_coef_rows: PointsRacePremiumCoef 里的所有行，字段('PremiumRatio','Coef')
    pay_amount_coef: "付费金额对应系数" —— 目前没找到对应配置表，暂时按1.0传入，
                     具体来源见 references/open-assumptions.md 第4条，需要产品/程序确认。
    energy_usd_value: 该次付费能获得的纯体力对应的美元价值

    返回：本次付费给水池增加的金额
    """
    if avg_pay <= 0:
        premium_ratio = 0
    else:
        premium_ratio = (current_pay - avg_pay) / avg_pay

    if premium_ratio < 0:
        premium_coef = 0  # 低于历史均值时，按文档说明取0（也可能有独立负向区间配置，待确认）
    else:
        premium_coef = lookup_tiered(premium_coef_rows, 'PremiumRatio', 'Coef', premium_ratio)

    return (current_pay - avg_pay) * premium_coef + energy_usd_value * pay_amount_coef


def compute_historical_avg_pay(pay_history, beta=0.92):
    """
    pay_history: list of (pay_amount, days_ago)
    实现 expected_pay = Σ(pay_i × β^t_i) / Σ(β^t_i)
    """
    numerator = sum(pay * (beta ** days_ago) for pay, days_ago in pay_history)
    denominator = sum(beta ** days_ago for _, days_ago in pay_history)
    if denominator == 0:
        return 0
    return numerator / denominator


# ---------------------------------------------------------------------------
# Worked example —— 对应 references/points-race-checkpoint.md 第9节
# 直接跑这个文件，应该打印出：节点a=6，累计体力奖励=1098，节点b区间=(11,14)
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    node_a_rows_4011 = [
        {'Indicator': 0, 'NodeA': 5},
        {'Indicator': 200, 'NodeA': 5},
        {'Indicator': 300, 'NodeA': 5},
        {'Indicator': 400, 'NodeA': 6},
        {'Indicator': 500, 'NodeA': 6},
        {'Indicator': 600, 'NodeA': 6},
        {'Indicator': 800, 'NodeA': 7},
    ]

    node_a = compute_node_a(
        current_energy=500, k=0, equity_coef=1.0, node_a_global_coef=1.0,
        node_a_rows=node_a_rows_4011
    )
    print(f"节点a = 第{node_a}个大节点 (期望值: 6)")

    # 3011组 StageID=1,4,7,10,13,16 的体力奖励(ItemID=2001的Delta)
    stage_rows_3011 = [
        {'StageID': 1, 'IsBigNode': 1, 'EnergyReward': 48},
        {'StageID': 4, 'IsBigNode': 1, 'EnergyReward': 110},
        {'StageID': 7, 'IsBigNode': 1, 'EnergyReward': 150},
        {'StageID': 10, 'IsBigNode': 1, 'EnergyReward': 190},
        {'StageID': 13, 'IsBigNode': 1, 'EnergyReward': 250},
        {'StageID': 16, 'IsBigNode': 1, 'EnergyReward': 350},
    ]
    energy_sum = sum_energy_reward_to_node(stage_rows_3011, node_a)
    print(f"节点1~{node_a}体力奖励累计 = {energy_sum} (期望值: 1098)")

    node_b_range_rows_4011 = [
        {'Indicator': 0, 'Lower': 10, 'Upper': 14},
        {'Indicator': 500, 'Lower': 10, 'Upper': 14},
        {'Indicator': 1000, 'Lower': 10, 'Upper': 14},
        {'Indicator': 2000, 'Lower': 11, 'Upper': 15},
    ]
    b_low, b_high = compute_node_b_range(
        current_energy=500, energy_reward_to_a=energy_sum,
        equity_coef=1.0, node_b_global_coef=1.0,
        node_a=node_a, node_b_range_rows=node_b_range_rows_4011,
        gap_min=5, gap_max=10
    )
    print(f"节点b区间 = [第{b_low}, 第{b_high}大节点] (期望值: [11, 14])")
