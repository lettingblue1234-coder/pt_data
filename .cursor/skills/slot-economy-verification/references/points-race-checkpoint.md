# 积分事件卡点/节点调控系统（Points Race Checkpoint System）

## 0. 一句话概括

系统用玩家当前状态算出两条分界线（节点a、节点b），把积分事件的进度循环切成
**奖励关 / 过渡关 / 卡点关**三段体验区；过渡关内每次spin动态计算一个"概率压制系数"
去调节积分图标替换概率的发生频率；卡点关是硬性阀门，靠体力/付费累计消耗量解除；
付费走独立的水池+独立替换线，可以直接给玩家"补差价"过关。

**新手期例外**：所有卡点设计对新手期不生效，新手期只跑专门配置的剧本，不做任何原因的替换。

## 1. 前置步骤：确定用哪套参数

- 查 `PointsRaceGroup`：按玩家当前体力值落在哪个区间(0/1000/3000/8000...)，
  确定这次用的 `CheckpointGroupID`（如4011）和对应的 `StageGroupID`（如3011）。
  `CheckpointGroupID=1` 是新手期默认组（`StageGroupID=3001`，只有26个节点，循环更短）。

## 2. 节点a（奖励关终点）

```
指标_a = (当前体力 + k) × EquityCoef[区域] × NodeAGlobalCoef[体力档]
节点a  = PointsRaceNodeA.lookup(CheckpointGroupID, 指标_a)   # 阶梯查找，见下方"查表规则"
```
- `k`：查 `c.PointsRaceCommon.NodeAIndicatorK`（当前=0）
- `EquityCoef`：查 `PointsRaceEquityCoef`，用(CheckpointGroupID, AreaID)定位（当前全1.0）
- `NodeAGlobalCoef`：查 `PointsRaceNodeAGlobalCoef`，用(CheckpointGroupID, 体力档)定位（当前全1.0）
- 节点a生成时机：**每次积分事件刷新**（不是每次spin都重算）
- 设计目标：至少覆盖前2-4个循环周期，保证前期"纯手气"体验

**⚠️ 重要发现**：`PointsRaceNodeA` 查出来的数值（如5/6/7）单位是**"第几个大节点"**，
不是`PointsRaceStage`表里的`StageID`！`PointsRaceStage`里`IsBigNode=1`的行才是"大节点"，
在3011/3012/3013/3014这几个StageGroupID里，大节点每3个StageID出现一次
（StageID=1,4,7,10,13,16,19,22,...对应大节点1,2,3,4,5,6,7,8,...）。
只有大节点才同时发放体力(ItemID=2001)+卡牌(ItemID=100012001)奖励，
中间的小节点(IsBigNode=0)只发大额金币(ItemID=1001)。

## 3. 节点b初始区间（过渡关终点区间/卡点关起点）

```
指标_b = (当前体力 + Σ[大节点1~节点a的体力奖励]) × EquityCoef[区域] × NodeBGlobalCoef[体力档]
[b_low, b_high]_init = PointsRaceNodeBRange.lookup(CheckpointGroupID, 指标_b)
```
- "Σ大节点1~节点a的体力奖励"：从`PointsRaceStage`里把`RoundID`/`StageID`从大节点1一路加到
  刚算出的节点a，累加每个大节点行`Rewards#1.ItemID=2001`的`ItemDelta`
- 节点b生成时机：积分事件刷新时生成一次**有跨度的区间**（不是单点）

**夹取跨度**（防止区间过窄或过宽）：
```
查 PointsRaceNodeBGapLimit(CheckpointGroupID) 得到 (m, n)
(b_low - 节点a) 限制在 [m, n] 内，超出则截断到边界
(b_high - 节点a) 同理限制在 [m, n] 内
```

## 4. 节点b动态更新（过渡关内实时进行，每次通过一次大循环节点测算一次步频）

```
指标_update = (当前体力 + 当前节点到节点a奖励体力之和)
            / (积分事件开启时体力 + 节点1到节点a奖励体力之和)
# 若玩家已超过节点a，则只算当前体力，不再加"到节点a奖励体力之和"这一项

Coef = PointsRaceNodeBUpdate.lookup(指标_update)   # 万分位，范围约 -5000 ~ +10000
新节点b = clamp(b_low, b_high, 旧节点b + ceil(Coef × (b_high - b_low)))
```
这本质是一个带上下限约束的P控制器：玩家实际进度快于预期→Coef为正→节点b前移（更快进入卡点关，
制造"更快遇到瓶颈"的体感）；慢于预期→Coef为负→节点b后移（放宽，让玩家更容易保持在过渡关的宽松区）。

## 5. 三段体验区的压制逻辑

### 5.1 奖励关（节点a之前）
完全自然概率，不做任何压制。

### 5.2 过渡关（节点a~节点b之间）
每次spin实时计算：
```
进度百分比 = 循环当前进度 / 循环总成本
过渡关百分比 = 当前过渡关编号 / 过渡关总个数
bet比 = 循环总成本 / 玩家当前bet

概率压制系数 = ProgressCoef.lookup(进度百分比) × BetCoef.lookup(bet比) / TransIndexCoef.lookup(过渡关百分比)
```
`ProgressCoef`/`BetCoef` 是概率放大/缩小的分段系数；`TransIndexCoef`是**除数**，
数值随过渡关编号增大而增大(10000→11364)，即越靠后的过渡关整体压制越轻，起到"后段自动放水"效果。

### 5.3 卡点关（节点b之后，硬性阀门）
沿用过渡关最后一格的压制曲线作为基准，判定"可以过关"时，有 `CheckpointK` 的概率**强制放行**
（不做原有替换）——当前`c.PointsRaceCommon.CheckpointK=10000`(=100%)，即目前判定可过关就必定放行。

**自动解除条件**：每个卡点关单独配一个累计体力消耗上限(`PointsRaceEnergyCap.EnergyCap`)
和累计付费消耗上限(`PointsRaceEnergyCap.PayAmountCap`)，任一达到上限，压制自动解除。

## 6. 放水调控（新手/每日登录赠送，优先级高于水池调控但低于新手期专属剧本）

`PointsRaceGiftReplace`：登录后若积分事件已开/即将开，按(unique_id, stage_id)匹配，
在接下来 `WindowSpinCount`(b) 次事件里，随机抽取 `GiftCount`(c) 次标记为"必中替换组`GiftReplaceGroupID`"。
若窗口未结束前 `OpenHour`/`Stage`/`Rate` 任一条件不再满足，则提前终止本次赠送。

## 7. 付费水池（独立于免费玩家的加速通道）

```
溢价比 = (当前付费金额 - 历史平均付费金额) / 历史平均付费金额
历史平均付费金额 = Σ(pay_i × β^t_i) / Σ(β^t_i)     β = PayPoolBeta(当前0.92)，t_i=距今天数

付费水池增量 = ((当前付费-历史均付费) × PremiumCoef.lookup(溢价比))
             + (该次付费能获得的纯体力对应美元价值 × 付费金额对应系数[⚠️未找到对应配置表])
```
- 若溢价比<0（本次付费低于历史均值），"溢价付费系数项"取0或走独立负向区间配置，避免水池为负
- 付费行为**只加水，不影响存量**，水池无上限但有 `PayPoolInactiveClearDays`(当前7天) 有效期，
  超期未使用则归零
- 付费水池有余额时，走独立的 `PayReplaceGroupID`（`PointsRaceStage`每个节点单独配，如2002），
  与免费玩家的普通`SlotReplaceGroupID`是**两条互斥线**，同时满足条件时优先走付费线
- 付费积分水池消耗 = bet × 单积分事件分数美元价值 × 每次spin获得积分对应的大致美元价值
  （积分→体力→美元，体力对美元的换算参照商店99.99美元档位的体力售价）
- **卡点关特殊补差价规则**：玩家处在卡点关消耗上限区间内时，若本次spin触发了压制系数k，
  系统会先把付费水池余额换算成体力，去补足"当前消耗到消耗上限"的差值并取消本次压制
  （替换结果本身保留，不抹除）；若水池余额不足以补满差额，则把全部水池余额都转化为消耗。

## 8. 限时加成（Mania，留存/唤醒向，与水池调控是两条独立机制）

`PointsRaceManiaCondition` 按账号生存天数(0/1/2)/当日登录次数(1/2/3)/档内进度(>70%或>85%)
触发条件，命中后给一个短时(600秒)、有冷却(2小时)的爆发奖励(`PointsRaceMania`，体力+80)。

## 9. 完整数值走查（worked example，用真实配置数据验算过）

设玩家当前体力=500，落在`CheckpointGroupID=4011`：

1. 指标_a = (500+0)×1.0×1.0 = 500 → 查`PointsRaceNodeA`(4011组) → **节点a=第6个大节点**
   （对应`PointsRaceStage`里`StageGroupID=3011`的`StageID=16`那一行）
2. 大节点1~6（StageID=1,4,7,10,13,16）体力奖励分别是48,110,150,190,250,350，累加=**1098**
3. 指标_b = (500+1098)×1.0×1.0 = 1598 → 查`PointsRaceNodeBRange`(4011组) → 初始区间=**[第10, 第14大节点]**
4. 查`PointsRaceNodeBGapLimit`(4011组) = m5/n10：(10-6)=4 < m=5 → 截断为b_low=6+5=**第11**；
   (14-6)=8 在[5,10]内不变 → b_high=**第14**
5. 最终：节点a=第6大节点，节点b区间=[第11, 第14大节点]

具体计算代码见 `scripts/checkpoint_calc.py`，函数名与上面公式一一对应。

## 查表规则（⚠️ 未经产品文档正面确认，是核心假设）

所有"按Indicator分档取值"的表，推断规则是**"取小于等于计算指标的最大那一档，取其对应值"**
（阶梯/floor查找）。这条规则从未被正面写出来过，务必用真实玩家的实际node a/b落点反向验证，
如果这条错了，第2-5节的全部计算都需要重新核对查表逻辑（可能是"最接近"、"向上取整到下一档"等其他规则）。
