# cursor-skills

个人 Cursor Agent Skills 仓库。用于跨机器同步取数口径与工作流（例如 PT / AE SQL 快取）。

## 本机用法

打开任意项目时，Cursor 会读该项目下的 `.cursor/skills/`。  
也可以把本仓库当作独立工作区打开，或把 skill 拷到个人目录：

```powershell
# Windows：同步到本机个人 skills
Copy-Item -Recurse -Force .\.cursor\skills\* $env:USERPROFILE\.cursor\skills\
```

```bash
# macOS / Linux
cp -R .cursor/skills/* ~/.cursor/skills/
```

## 仓库结构

```
.cursor/skills/
  pt-ae-sql/SKILL.md   # PT(piggytycoon/261) AE SQL 已确认口径与快取路径
```

## 新机器上手

1. `git clone <本仓库 URL>`
2. 用 Cursor 打开该仓库，或执行上面的 Copy/cp 命令
3. 新对话里提到 PT / 付费 / 登录 / 在线时长时，Agent 应自动使用 `pt-ae-sql`

## 维护约定

分析中确认了新口径或纠错后，**先改** `.cursor/skills/<name>/SKILL.md`，再 `git commit` / `git push`。  
本机 `~/.cursor/skills` 与 `~/.agents/skills` 可按需再拷一份，以 git 仓库为权威来源。
