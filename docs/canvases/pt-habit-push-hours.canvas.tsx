import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  LineChart,
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

/** D1–D3 local-hour login share (% of that country's logins). Source: adhoc 2026-09-14. */
const hours = Array.from({ length: 24 }, (_, i) => String(i));

const usPct = [
  5.2, 5.4, 5.7, 5.8, 5.9, 6.3, 6.0, 6.3, 6.2, 6.4, 5.7, 4.3, 3.4, 2.4, 1.9, 1.2, 1.0,
  1.1, 1.4, 2.2, 3.0, 3.5, 4.3, 5.3,
];
const gbPct = [
  5.4, 5.9, 6.5, 6.5, 6.8, 6.3, 6.1, 6.5, 6.2, 6.7, 5.3, 3.8, 2.9, 1.6, 0.8, 0.7, 0.4,
  0.6, 1.0, 2.0, 3.1, 4.3, 5.2, 5.4,
];

const peakSeries = [
  { name: "US 当地%", data: usPct },
  { name: "GB 当地%", data: gbPct },
];

export default function HabitPushHours() {
  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 960 }}>
      <Stack gap={6}>
        <H1>登录高峰与推送窗口</H1>
        <Text tone="secondary" size="small">
          队列 2026-08-25～09-02 · US/GB · 安卓+苹果 · 生命日 D1–D3 · n=15,851 ·
          当地时：US=会话 -4；GB=+5h（夏令时伦敦）
        </Text>
      </Stack>

      <Grid columns={3} gap={12}>
        <Stat value="5–9" label="主推送窗（当地）" />
        <Stat value="13–18" label="避开（下午谷）" tone="warning" />
        <Stat value="21–23" label="次选夜窗" />
      </Grid>

      <Callout tone="info">
        US 与 GB 曲线同形：早 4–10 为平台高峰，下午 13–18 最低，夜间回升但不高于早高峰。推送按当地时区配置。
      </Callout>

      <Card>
        <CardHeader>当地小时登录占比（D1–D3）</CardHeader>
        <CardBody>
          <LineChart
            categories={hours}
            series={peakSeries}
            height={320}
            valueSuffix="%"
            fill
            beginAtZero
            yMax={8}
          />
          <Text tone="secondary" size="small" style={{ marginTop: 8 }}>
            横轴：当地小时 0–23 · 纵轴：占该国 D1–D3 全部 t_login 的百分比 · Source: hive.ta.v_event_261
          </Text>
        </CardBody>
      </Card>

      <H2>推送建议</H2>
      <Table
        headers={["当地窗口", "建议", "依据"]}
        rows={[
          ["5:00–9:00（可扩 4–10）", "主推送窗", "US/GB 高峰平台，单小时约 6.0–6.8%"],
          ["13:00–18:00", "避开", "谷底；GB 16 点仅 0.4%，US 约 1%"],
          ["21:00–23:00", "次选", "夜回升至约 3.5–5.4%，弱于早高峰"],
        ]}
      />

      <H2>习惯分位（D1–D3 活跃日）</H2>
      <Grid columns={3} gap={12}>
        <Stat value="1 / 1 / 3" label="登录 P25 / P50 / P75" />
        <Stat value="3.2 / 6.5 / 13.5" label="单次会话分钟" />
        <Stat value="9.1 / 18.3 / 29.4" label="日在线分钟" />
      </Grid>
      <Text tone="secondary" size="small">
        节奏按「多次 5–10 分钟」设计；推送文案宜短、可一次会话吃完。明细见 docs/exports/2026-09-14-pt-habit-analysis.xlsx
      </Text>
    </Stack>
  );
}
