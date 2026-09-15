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
  LineChart,
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

/** Cohort 2026-08-25～09-02 · US/GB · Android+iOS · active days only · D1=reg day */

const lifeDays = ["D1", "D2", "D3", "D4", "D5"];

const lifeLogin = [
  { name: "登录均", data: [2.2, 3.1, 3.31, 3.47, 3.46] },
  { name: "登录P50", data: [1, 2, 2, 2, 2] },
];
const lifeSessionP50 = [{ name: "单次会话P50", data: [7.52, 5.48, 5.53, 6.51, 5.88] }];
const lifeDayOnline = [
  { name: "日在线P50", data: [18.96, 16.24, 17.23, 25.18, 23.66] },
  { name: "日在线均", data: [24.72, 36.33, 37.2, 46.94, 41.94] },
];

const payCats = ["非付费", "0–5", "5–20", "20–50", "50+"];
const payLoginP50 = [{ name: "登录P50", data: [1, 3, 3, 4, 6] }];
const payDayOnlineP50 = [{ name: "日在线P50(分)", data: [17.13, 34.09, 45.66, 56.3, 72.57] }];
const paySessionP50 = [{ name: "单次会话P50(分)", data: [6.69, 5.52, 5.75, 5.66, 7.72] }];

const d1PayCats = ["0笔", "1笔", "2笔", "3笔+"];
const d1PayDayOnline = [{ name: "日在线P50(分)", data: [17.64, 46.89, 53.4, 69.67] }];
const d1PayLogin = [{ name: "登录P50", data: [1, 3, 3, 4] }];

export default function HabitOverview() {
  return (
    <Stack gap={28} style={{ padding: 24, maxWidth: 980 }}>
      <Stack gap={6}>
        <H1>用户习惯总览（D1–D5）</H1>
        <Text tone="secondary" size="small">
          队列 2026-08-25～09-02 · US/GB · 安卓+苹果 · n=15,851 · 仅活跃日（有
          t_login）· D1=注册当天 · Source: v_event_261 · Excel
          docs/exports/2026-09-14-pt-habit-analysis.xlsx
        </Text>
      </Stack>

      <Callout tone="info">
        节奏按「多次 5–10 分钟」设计：D1–D3 登录 P50=1、会话 P50≈6.5 分、日在线
        P50≈18 分。差异主轴是付费深度，不是地区。
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="15,851" label="队列人数" />
        <Stat value="1 / 1 / 3" label="D1–D3 登录 P25/P50/P75" />
        <Stat value="6.5 分" label="D1–D3 会话 P50" />
        <Stat value="18.3 分" label="D1–D3 日在线 P50" />
      </Grid>

      <H2>生命日曲线</H2>
      <Text tone="secondary" size="small">
        活跃人数：D1 15851 → D2 4175（26%）→ D3 2412（15%）→ D4 1821 → D5 1561
      </Text>

      <Card>
        <CardHeader>活跃日登录次数（均值 vs P50）</CardHeader>
        <CardBody>
          <LineChart
            categories={lifeDays}
            series={lifeLogin}
            height={260}
            valueSuffix=" 次"
            showValues
            beginAtZero
            yMax={5}
          />
          <Text tone="secondary" size="small" style={{ marginTop: 8 }}>
            横轴：注册生命日 · 纵轴：当天有登录的人，人均登录次数
          </Text>
        </CardBody>
      </Card>

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader>单次会话 P50（分钟）</CardHeader>
          <CardBody>
            <LineChart
              categories={lifeDays}
              series={lifeSessionP50}
              height={240}
              valueSuffix=" 分"
              showValues
              beginAtZero
              yMax={10}
            />
            <Text tone="secondary" size="small" style={{ marginTop: 8 }}>
              分母：t_online_time 会话条数 · D1 探索更长，回访变短
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>活跃日日在线（P50 / 均，分钟）</CardHeader>
          <CardBody>
            <LineChart
              categories={lifeDays}
              series={lifeDayOnline}
              height={240}
              valueSuffix=" 分"
              showValues
              beginAtZero
              yMax={55}
            />
            <Text tone="secondary" size="small" style={{ marginTop: 8 }}>
              人日会话时长之和 · D2/D3 均值被重度拉高，看 P50；D4–D5 幸存者上台阶
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <Divider />

      <H2>累计付费档（D1–D3 活跃日）</H2>
      <Text tone="secondary" size="small">
        pay_amt USD：非付费 / 0–5 / 5–20 / 20–50 / 50+ · 人数 15001 / 413 / 279 /
        108 / 50（高档样本少）
      </Text>

      <Grid columns={3} gap={12}>
        <Card>
          <CardHeader>登录 P50</CardHeader>
          <CardBody>
            <BarChart
              categories={payCats}
              series={payLoginP50}
              height={220}
              beginAtZero
              yMax={8}
              showValues
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>日在线 P50（分）</CardHeader>
          <CardBody>
            <BarChart
              categories={payCats}
              series={payDayOnlineP50}
              height={220}
              beginAtZero
              yMax={80}
              showValues
              valueSuffix=" 分"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>单次会话 P50（分）</CardHeader>
          <CardBody>
            <BarChart
              categories={payCats}
              series={paySessionP50}
              height={220}
              beginAtZero
              yMax={10}
              showValues
              valueSuffix=" 分"
            />
          </CardBody>
        </Card>
      </Grid>
      <Callout tone="neutral">
        付费拉开的是登录频次与日在线；单次会话长度各档接近（约 5.5–7.7 分）。
      </Callout>

      <H2>首日付费笔数（D1–D3）</H2>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader>登录 P50 × 首日笔数</CardHeader>
          <CardBody>
            <BarChart
              categories={d1PayCats}
              series={d1PayLogin}
              height={220}
              beginAtZero
              yMax={5}
              showValues
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>日在线 P50 × 首日笔数（分）</CardHeader>
          <CardBody>
            <BarChart
              categories={d1PayCats}
              series={d1PayDayOnline}
              height={220}
              beginAtZero
              yMax={80}
              showValues
              valueSuffix=" 分"
            />
          </CardBody>
        </Card>
      </Grid>

      <Divider />

      <H2>端 / 地区（D1–D3）</H2>
      <Table
        headers={[
          "切片",
          "登录均",
          "登录P50",
          "会话P50",
          "日在线P50",
          "日在线P75",
        ]}
        rows={[
          ["总体 D1–D3", "2.49", "1", "6.54", "18.26", "29.35"],
          ["US", "2.48", "1", "6.61", "18.44", "30.48"],
          ["GB", "2.50", "1", "6.47", "18.13", "28.41"],
          ["安卓", "2.30", "1", "7.10", "18.62", "28.97"],
          ["苹果", "2.75", "2", "5.99", "17.86", "30.27"],
        ]}
        columnAlign={["left", "right", "right", "right", "right", "right"]}
      />
      <Text tone="secondary" size="small">
        US≈GB；苹果更勤、单局略短，落到日在线两端接近。
      </Text>

      <H2>D1–D3 分位宽表（主报告）</H2>
      <Table
        headers={["指标", "均", "P25", "P50", "P75"]}
        rows={[
          ["活跃日登录次数", "2.49", "1", "1", "3"],
          ["单次会话（分）", "11.54", "3.18", "6.54", "13.46"],
          ["活跃日日在线（分）", "28.22", "9.12", "18.26", "29.35"],
        ]}
        columnAlign={["left", "right", "right", "right", "right"]}
      />

      <Text tone="secondary" size="small">
        推送高峰图见同目录 pt-habit-push-hours
      </Text>
    </Stack>
  );
}
