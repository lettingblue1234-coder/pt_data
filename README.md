# cursor-skills / pt_data

个人 Cursor Agent Skills 仓库。跨机器同步 PiggyTycoon（PT / project 261）取数口径、分析纪律与 Slot 经济验证知识。

远程：`https://github.com/lettingblue1234-coder/pt_data.git`

## 本机用法

打开任意项目时，Cursor 会读该项目下的 `.cursor/skills/`。  
也可以把本仓库当工作区打开，或同步到个人目录：

```powershell
Copy-Item -Recurse -Force .\.cursor\skills\* $env:USERPROFILE\.cursor\skills\
```

```bash
cp -R .cursor/skills/* ~/.cursor/skills/
```

## Skills

| Skill | 何时用 |
|---|---|
| `pt-ae-sql` | ae-cli adhoc 快取：付费美分档、登录、在线时长、生命周期 D1–D3（D1=注册当天） |
| `piggytycoon-sql` | 数数看板 SQL：留存/LTV/ARPPU/首充复购/枚举；含踩坑与分析纪律（留存 D1=次日） |
| `slot-economy-verification` | 机台 RTP + 积分卡点公式验证；可跑 `scripts/checkpoint_calc.py` |

## 仓库结构

```
.cursor/skills/
  pt-ae-sql/
  piggytycoon-sql/          # + references/{templates,enums,project-context,ae-cli}
  slot-economy-verification/# + references + scripts/checkpoint_calc.py
docs/sources/               # 交接原文归档（非 skill 运行时必需）
packages/                   # 可分发的 .skill zip 包
```

## 新机器上手

1. `git clone https://github.com/lettingblue1234-coder/pt_data.git`
2. 用 Cursor 打开该仓库，或执行上面的 Copy/cp
3. 提到 PT / 付费留存 / 机台卡点时，Agent 应命中对应 skill

## 维护约定

确认了新口径或纠错后：**先改** `.cursor/skills/<name>/`，再 commit / push。  
`docs/sources/` 只作溯源；可执行知识以 skill 正文与 `references/` 为准。
