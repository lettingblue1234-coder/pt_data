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
  Row,
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

const PHASE_ROWS = [
  {
    phase: "A 改前",
    d1: 352,
    churn: 157,
    persona: 38,
    pctPay: 10.8,
    pctChurn: 24.2,
    churnRate: 44.6,
  },
  {
    phase: "B 修改期",
    d1: 119,
    churn: 44,
    persona: 13,
    pctPay: 10.9,
    pctChurn: 29.5,
    churnRate: 37.0,
  },
  {
    phase: "C 回退后",
    d1: 172,
    churn: 77,
    persona: 18,
    pctPay: 10.5,
    pctChurn: 23.4,
    churnRate: 44.8,
  },
];

const OS_ROWS = [
  {
    os: "Android",
    d1: 368,
    churn: 181,
    persona: 45,
    pctPay: 12.2,
    pctChurn: 24.9,
    churnRate: 49.2,
  },
  {
    os: "iOS",
    d1: 275,
    churn: 97,
    persona: 24,
    pctPay: 8.7,
    pctChurn: 24.7,
    churnRate: 35.3,
  },
];

const CROSS_ROWS = [
  { cell: "A × Android", d1: 222, persona: 26, pctPay: 11.7, pctChurn: 24.5, note: "" },
  { cell: "A × iOS", d1: 130, persona: 12, pctPay: 9.2, pctChurn: 23.5, note: "" },
  { cell: "B × Android", d1: 51, persona: 8, pctPay: 15.7, pctChurn: 30.8, note: "n=8，仅看方向" },
  { cell: "B × iOS", d1: 68, persona: 5, pctPay: 7.4, pctChurn: 27.8, note: "n=5，仅看方向" },
  { cell: "C × Android", d1: 95, persona: 11, pctPay: 11.6, pctChurn: 22.4, note: "" },
  { cell: "C × iOS", d1: 77, persona: 7, pctPay: 9.1, pctChurn: 25.0, note: "" },
];

const FUNNEL = [
  { step: "D1 付费", n: 643, pct: 100 },
  { step: "→ D2 未登录", n: 278, pct: 43.2 },
  { step: "→ 且快付浅玩", n: 112, pct: 17.4 },
  { step: "→ 且终停阶段6", n: 71, pct: 11.0 },
  { step: "→ 且 area≤103（画像1.1）", n: 69, pct: 10.7 },
];

export default function PtPersona11AbcOs() {
  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 980 }}>
      <Stack gap={8}>
        <H1>画像 1.1 占比 · A/B/C × 双端</H1>
        <Text tone="secondary" size="small">
          PT / project 261 · US+GB · 注册 2026-08-25～09-12 · 会话 UTC-4 · D1=注册当天 ·
          画像= D1付费∩D2未登∩快付(&lt;30分)∩浅玩(日在线&lt;60分)∩终停阶段6∩area≤103
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="69" label="画像 1.1 人数" />
        <Stat value="10.7%" label="占 D1 付费" tone="accent" />
        <Stat value="24.8%" label="占 D2 流失" />
        <Stat value="643" label="D1 付费分母" />
      </Grid>

      <Callout tone="info" title="读法">
        占 D1 付费：这批人在首日付费里有多常见。占 D2
        流失：次日不回的人里，有多少是这套「快付浅玩+卡在6+浅地图」组合。A/B/C
        在「占 D1 付费」几乎持平；双端差主要来自 Android 更高的 D2 流失率。
      </Callout>

      <Stack gap={12}>
        <H2>漏斗（全体，占 D1 付费）</H2>
        <Table
          headers={["步骤", "人数", "占 D1 付费 %"]}
          rows={FUNNEL.map((r) => [r.step, String(r.n), r.pct.toFixed(1)])}
        />
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>A / B / C</H2>
        <Text tone="secondary" size="small">
          切点（UTC-4）：A &lt; 08-31 10:29:48；B 至 &lt; 09-02 22:37:10；C 之后（对应北京
          08-31 22:29:48 / 09-03 10:37:10）
        </Text>
        <BarChart
          categories={PHASE_ROWS.map((r) => r.phase)}
          series={[
            {
              name: "占 D1 付费 %",
              data: PHASE_ROWS.map((r) => r.pctPay),
            },
            {
              name: "占 D2 流失 %",
              data: PHASE_ROWS.map((r) => r.pctChurn),
            },
          ]}
          height={220}
        />
        <Table
          headers={[
            "阶段",
            "D1付费",
            "D2流失",
            "画像人数",
            "占D1付费%",
            "占D2流失%",
            "D2流失率%",
          ]}
          rows={PHASE_ROWS.map((r) => [
            r.phase,
            String(r.d1),
            String(r.churn),
            String(r.persona),
            r.pctPay.toFixed(1),
            r.pctChurn.toFixed(1),
            r.churnRate.toFixed(1),
          ])}
        />
        <Text size="small" tone="secondary">
          A/B/C 画像占 D1 付费 ≈10.5–10.9%，几乎无差。B 期 D2
          流失率更低（37%），但流失内部画像浓度略高（29.5%）；B 样本量偏薄。
        </Text>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>iOS vs Android</H2>
        <Grid columns={2} gap={12}>
          <Card>
            <CardHeader title="Android" />
            <CardBody>
              <Stack gap={6}>
                <Row gap={16}>
                  <Stat value="45" label="画像人数" />
                  <Stat value="12.2%" label="占D1付费" tone="accent" />
                </Row>
                <Text size="small" tone="secondary">
                  D2 流失率 49.2% · 占流失 24.9%
                </Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="iOS" />
            <CardBody>
              <Stack gap={6}>
                <Row gap={16}>
                  <Stat value="24" label="画像人数" />
                  <Stat value="8.7%" label="占D1付费" />
                </Row>
                <Text size="small" tone="secondary">
                  D2 流失率 35.3% · 占流失 24.7%
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
        <Table
          headers={[
            "端",
            "D1付费",
            "D2流失",
            "画像人数",
            "占D1付费%",
            "占D2流失%",
            "D2流失率%",
          ]}
          rows={OS_ROWS.map((r) => [
            r.os,
            String(r.d1),
            String(r.churn),
            String(r.persona),
            r.pctPay.toFixed(1),
            r.pctChurn.toFixed(1),
            r.churnRate.toFixed(1),
          ])}
        />
        <Text size="small" tone="secondary">
          在「已经次日不回」的人里，两端画像浓度几乎一样（~25%）。Android
          画像占付费更高，主要因为流失面更大，不是流失结构更偏这套画像。
        </Text>
      </Stack>

      <Divider />

      <Stack gap={12}>
        <H2>交叉：阶段 × 端</H2>
        <Table
          headers={["格子", "D1付费", "画像", "占D1付费%", "占D2流失%", "备注"]}
          rows={CROSS_ROWS.map((r) => [
            r.cell,
            String(r.d1),
            String(r.persona),
            r.pctPay.toFixed(1),
            r.pctChurn.toFixed(1),
            r.note || "—",
          ])}
          rowTone={CROSS_ROWS.map((r) => (r.note ? "warning" : undefined))}
        />
        <Text size="small" tone="secondary">
          B×Android 画像占付费抬到 15.7%、B×iOS 压到
          7.4%，但分子都 &lt;10，只能作方向，不能当调整因果结论。
        </Text>
      </Stack>
    </Stack>
  );
}
