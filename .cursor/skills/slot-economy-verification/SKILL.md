---
name: slot-economy-verification
description: >
  验证SLOTS游戏机台经济系统（机台基础RTP + 积分事件卡点/节点调控）的线上真实数据是否符合设计预期。
  当需要拉取线上配置表(SlotBase/SlotWeight/SlotReplaceWeight/SlotReplaceGroup/SlotIconType/SlotEvent，
  或PointsRace/PointsRaceGroup/PointsRaceStage/PointsRaceNodeA/PointsRaceNodeBRange/PointsRaceNodeBUpdate/
  PointsRaceProgressCoef/PointsRaceBetCoef/PointsRaceTransIndexCoef/PointsRaceEnergyCap/
  PointsRacePremiumCoef等)与玩家实际数据，计算期望的机台产出、图标替换概率、积分事件节点a/b位置、
  概率压制系数、付费水池余额等数值，并核对是否与玩家实际体验(spin结果分布、进度推进速度、
  卡点通过体验、付费转化)一致时，必须使用本skill。任何提到"节点a/b"、"卡点关"、"概率压制系数"、
  "金币RTP"、"体力RTP"、"积分事件"、"付费水池"、"机台权重"的验证/复现/排查类需求都应触发本skill，
  即使用户没有明确说"用这个skill"。
---

# Slot机台经济系统验证

本skill封装了对某SLOTS游戏机台经济模型的完整逆向工程结果（通过与产品反复核对配置表和设计文档
得出），供另一个有权限访问线上配置表/玩家数据的Agent，用来**验证玩家实际体验是否符合数值设计预期**。

## 系统组成（两个独立子系统）

1. **机台基础经济**（单次spin的图标、权重、RTP、运营活动图标替换）
   → 完整公式与表结构见 `references/slot-base-economy.md`
2. **积分事件卡点/节点调控系统**（用体力RTP驱动的核心循环，含动态难度调节+付费水池）
   → 完整公式与表结构见 `references/points-race-checkpoint.md`

## 读取顺序建议

| 任务类型 | 先读 |
|---|---|
| 单次spin产出/概率/金币RTP是否符合预期 | `slot-base-economy.md` |
| 积分事件节点a/b位置、卡点体验、压制感是否符合预期 | `points-race-checkpoint.md` |
| 付费后是否"体验到明显放水"、付费水池扣减是否正确 | `points-race-checkpoint.md` 第5节 |
| 需要**实际算出**节点a/b/压制系数/付费水池的数值 | 直接调用 `scripts/checkpoint_calc.py`，不要手算，公式细节多且容易算错 |
| 某个判断/公式到底成不成立，把握不大 | 先查 `references/open-assumptions.md`，很多细节是靠数值规律反推的，**没有被产品文档正面确认过** |
| 讨论「为什么要膨胀 / 购买力钩子 vs 长期通胀」 | `references/economy-design-notes.md`（产品设计语境；不要代替公式验证） |
| 玩家行为/付费漏斗/留存 LTV 取数 | 另开 skill `piggytycoon-sql` / `pt-ae-sql`，本 skill 只管机台与卡点数值 |

## 验证工作流（核心流程，给拉线上数据的Agent用）

给定一个或一批玩家（建议覆盖：低/中/高体力消耗玩家、付费/免费玩家、不同CheckpointGroupID），执行：

1. **拉玩家状态**：当前体力、AreaID、当前积分事件的 `UniqueID`/`StageID`(当前所在阶段)、
   最近N次spin的完整记录（每次spin前后体力、原始老虎机结果、是否被替换、替换成了什么、
   本次spin使用的SlotReplaceGroupID/PayReplaceGroupID）、付费记录（金额、时间戳）。
2. **拉对应配置表**（表名见上面description，具体每张表的字段含义见两个references文件）。
3. **用 `scripts/checkpoint_calc.py` 算期望值**：
   - `compute_node_a()` → 期望的节点a位置（"第几个大节点"）
   - `compute_node_b_range()` + `clamp_gap()` → 期望的节点b初始区间
   - `update_node_b()` → 玩家当前实际进度下，节点b应该移动到哪
   - `compute_suppression_coef()` → 当前spin应有的概率压制系数
   - `compute_pay_pool()` → 当前应有的付费水池余额
4. **对比实际，输出偏差报告**，重点检查：
   - 替换事件是否只在"节点a之后"才开始出现？节点a之前(奖励关)理论上不应该有任何压制/放水痕迹（除非是`PointsRaceGiftReplace`的新手放水，那个优先级更高，需要单独排除）。
   - 玩家推进节点a→b所消耗的体力总量，是否落在活动RTP规划设定的"2-4个循环周期"预期范围内？
   - 付费后下一次spin，是否确实切换到了该阶段的`PayReplaceGroupID`而不是普通`SlotReplaceGroupID`？
   - 卡点关(节点b之后)玩家的体力/付费累计消耗，是否在触碰`PointsRaceEnergyCap`/`PayAmountCap`后立刻解除压制（表现为下一次必定不被压制）？
   - 异常阈值建议：期望值与实际值偏差超过±20%先标记，具体阈值请与产品确认。

## 已知的"设计缺口"（不要误报为bug）

- `PointsRacePremiumCoef` / `PointsRaceNodeAGlobalCoef` / `PointsRaceNodeBGlobalCoef` / `PointsRaceEquityCoef`
  当前全部是占位值(=1.0/10000)，尚未做玩家分层调优。这些系数目前"没有区分度"是预期状态，不是异常。
- 付费水池公式里"该次付费能获得的纯体力对应美元价值 × **付费金额对应系数**"——这个系数目前**没有找到对应配置表**，
  怀疑尚未实现。验证付费水池时，如果发现这一项被跳过/恒为1，先假设是"未实现"而不是"配置错误"。
- `c.PointsRaceCommon.CheckpointK = 10000`(=100%)：卡点关当前是"判定可过关后必定放行"，
  尚未加入随机性。如果观测到"卡点关从来不会二次拦截"，这是当前默认设计，不是异常。
- `SlotReplaceWeight` 里"双积分图标(20010007)"和"三积分图标(20010008)"两行的 `AmpCoef`/`DecayCoef`
  目前都是 0/0，也就是水池调控目前只对"单积分图标"生效。这是产品文档里提到的**待补漏洞**，
  验证时如果发现"双/三积分图标完全不受水池调控影响"，这其实是已知问题，可以直接引用。

## 核心未验证假设

见 `references/open-assumptions.md` 完整列表，其中**最关键、影响全部计算结果**的一条：

> 所有"按Indicator分档取值"的表（NodeA / NodeBRange / ProgressCoef / BetCoef / TransIndexCoef / NodeBUpdate）
> 的查表规则，推断是"取小于等于计算出的指标值的最大那一档"（阶梯查找/floor lookup）。
> **这条规则没有在任何设计文档里被正面写出来，是完全靠数值规律反推的**。
> 建议第一步就用几个真实玩家的实际节点a/b落点，反向验证这条规则是否成立——如果这条错了，
> 后面所有计算全部要重算。
