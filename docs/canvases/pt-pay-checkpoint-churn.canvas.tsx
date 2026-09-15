import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

/**
 * Synthesis: paid checkpoints vs D1-pay D2 churn
 * Cohort: register 2026-08-25～09-02, US+GB, D1 pay 471 (churn 201 / return 270)
 * Life-day D1 = register day (AE convention)
 */

const stageBuckets = [
  { label: "没到6", churn: 14, ret: 11 },
  { label: "停在6", churn: 116, ret: 126 },
  { label: "过了6", churn: 71, ret: 133 },
];

const stuck6Type = [
  { type: "浅触早退", churn: 30, ret: 16, spin: "22 / 31", stay: "7 / 7" },
  { type: "中间态", churn: 39, ret: 35, spin: "~40", stay: "12 / 21" },
  { type: "卡点空转", churn: 47, ret: 75, spin: "88 / 99", stay: "29 / 128" },
];

const payTier = [
  { tier: "$0–5", n: 408, pass6: 20, stuck6: 70, d2: 60 },
  { tier: "$5–20", n: 175, pass6: 80, stuck6: 20, d2: 60 },
  { tier: "$20–50", n: 52, pass6: 90, stuck6: 0, d2: 60 },
];

export default function PtPayCheckpointChurn() {
  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 1040 }}>
      <Stack gap={6}>
        <H1>付费卡点 × D2 流失：影响与优化</H1>
        <Text tone="secondary" size="small">
          口径：注册 8/25–9/2 · US+GB · D1 付费 471（流失 201 / 回访 270）· 生命日 D1=注册当天
        </Text>
        <Text tone="secondary" size="small">
          来源：刀 A 停6分型 · 刀 B 送分承接 · 金额档交叉 · 习惯分析（快付浅玩）
        </Text>
      </Stack>

      <Callout tone="warning">
        总判：付费卡点决定「停在哪」（微氪多停 6）；次日流失更像「玩得够不够深 / 付完就走」。
        不要用「降阶段 6 卡点空转」当主药治 D2。
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat label="D2 回访率" value="57.3%" />
        <Stat label="流失过了6" value="35%" tone="danger" />
        <Stat label="回访过了6" value="49%" tone="success" />
        <Stat label="微氪停在6" value="70%" tone="warning" />
      </Grid>

      <Divider />

      <Stack gap={10}>
        <H2>1. A / B 假设怎么结案</H2>
        <Grid columns={2} gap={16}>
          <Card>
            <CardHeader>A · 阶段 6 卡点感</CardHeader>
            <CardBody>
              <Stack gap={8}>
                <Text weight="semibold">对流失：不成立为主因</Text>
                <Text size="small" tone="secondary">
                  回访里「卡点空转」更多（占停6的 60% vs 41%），且磨得更久（停留 P50 128 分 vs 29 分），次日仍回。
                  流失更偏浅触早退；进6后最低体力 P50 仍 ~275，像到了就走。
                </Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>B · 送分「只够过 4」</CardHeader>
            <CardBody>
              <Stack gap={8}>
                <Text weight="semibold">对进度：成立 · 对次留：脱钩</Text>
                <Text size="small" tone="secondary">
                  首付几乎都在阶段4；微氪（$0–5）过4后再付 P50=$0，过6仅 20%、停6约 70%。
                  但各金额档 D2 回访都约 60%——钱够不够过6，不直接决定次日回不回。
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Stack gap={10}>
        <H2>2. 终点桶：真正拉开的是「有没有过 6」</H2>
        <BarChart
          title="D1 最高阶段桶人数"
          categories={stageBuckets.map((r) => r.label)}
          series={[
            { name: "D2 流失", data: stageBuckets.map((r) => r.churn) },
            { name: "D2 回访", data: stageBuckets.map((r) => r.ret) },
          ]}
          height={220}
        />
        <Text size="small" tone="secondary">
          没到6很少（流失14 / 回访11）。过6：回访133（49%）vs 流失71（35%）。相关≠因果：过6与更深玩法/更多付费共变。
        </Text>
      </Stack>

      <Stack gap={10}>
        <H2>3. 停在 6 的分型（流失 / 回访）</H2>
        <Table
          headers={[
            "分型",
            "流失 n",
            "回访 n",
            "进6后 spin P50",
            "进6后停留 P50（分）",
          ]}
          rows={stuck6Type.map((r) => [
            r.type,
            String(r.churn),
            String(r.ret),
            r.spin,
            r.stay,
          ])}
        />
        <Text size="small" tone="secondary">
          浅触：进6后 spin&lt;20 或停留&lt;10分 · 空转：spin≥50 且停留≥15分 · 斜杠=流失/回访
        </Text>
      </Stack>

      <Stack gap={10}>
        <H2>4. 金额档：送分阀门 vs 次留</H2>
        <BarChart
          title="金额档：过6率 vs D2回访率（%）"
          categories={payTier.map((r) => r.tier)}
          series={[
            { name: "过了6 %", data: payTier.map((r) => r.pass6) },
            { name: "D2回访 %", data: payTier.map((r) => r.d2) },
          ]}
          height={220}
        />
        <Table
          headers={["D1累计", "n", "过了6", "停在6", "D2回访"]}
          rows={payTier.map((r) => [
            r.tier,
            String(r.n),
            `${r.pass6}%`,
            `${r.stuck6}%`,
            `${r.d2}%`,
          ])}
        />
        <Text size="small" tone="secondary">
          金额窗扩到 8/25–9/12 同口径交叉；$0–5 与 $5–20 过6差 60pp，D2 持平。
        </Text>
      </Stack>

      <Divider />

      <Stack gap={10}>
        <H2>5. 付费卡点对流失的真实作用</H2>
        <Grid columns={3} gap={12}>
          <Card>
            <CardHeader>阶段 4</CardHeader>
            <CardBody>
              <Text size="small">
                转化阀门。两边 ~95% 在阶段4首付；破第一卡点成功，不是流失主因。
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>阶段 6</CardHeader>
            <CardBody>
              <Text size="small">
                微氪当天进度天花板（EnergyCap 约2×阶段4）。制造「停在6」终点，但磨关者不等于次日流失。
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>真正拖次留</CardHeader>
            <CardBody>
              <Text size="small">
                快付浅玩（D2 33% vs 其他66%）、付后≤15分离开（D2 31.5%）、地图卡103门（到104+ 回访更高）。
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Stack gap={10}>
        <H2>6. 优化优先级（拆两条 OKR）</H2>
        <H3>OKR-R · 抬付费次留（先做）</H3>
        <Table
          headers={["动作", "打谁", "为什么"]}
          rows={[
            [
              "付后强制/引导再玩一段（目标：付后停留↑、≤15分离开↓）",
              "快付浅玩 / 浅触早退",
              "拉开 D2 的是撤出，不是磨关",
            ],
            [
              "D2 召回推送对齐当地 5–9 点",
              "D1付费且浅玩",
              "习惯分析登录高峰",
            ],
            [
              "降低 103→104 末段消耗（或等价过门）",
              "停103 的中深度付费",
              "大门是103，不是105；过104者~93%当天到105+",
            ],
            [
              "US 安卓单独盯付费次留 / 买量",
              "结构拖累端",
              "A/B/C 显示安卓次留长期偏低",
            ],
          ]}
        />
        <H3>OKR-P · 抬微氪过6（可并行，别当次留主药）</H3>
        <Table
          headers={["动作", "预期", "风险"]}
          rows={[
            [
              "首日首笔礼包：过4后留残值送分 / 水池，让$2.99能摸到过6或明显推进6",
              "微氪过6 20%→更高；内容解锁更多",
              "可能伤二充动机；用过6率+二充率双看",
            ],
            [
              "阶段6 EnergyCap 下调或首日首充玩家临时降档",
              "硬磨成本下降",
              "磨关者本就回访好——次留未必涨",
            ],
            [
              "过4后明确二充钩子：「再补一档过第二关」",
              "抬$5–20渗透与过6",
              "别把钩子做成挫败；浅玩者可能直接走",
            ],
          ]}
        />
      </Stack>

      <Callout tone="info">
        验收：次留看「付后停留 / 浅触占比 / 快付浅玩 D2」；进度看「微氪过6率 / 过4后再付占比」。
        两套指标分开报，避免「过6涨了但次留不动」被误读成失败或成功。
      </Callout>
    </Stack>
  );
}
