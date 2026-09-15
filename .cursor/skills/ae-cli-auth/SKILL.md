---
name: ae-cli-auth
description: >-
  Log in to ForeverNine AE with ae-cli device-code flow, including the correct
  host URL, agent split-flow (--no-wait / --device-code), and common host/path
  mistakes. Use when the user asks how to log in to ae-cli, runs auth login /
  auth status / auth logout, gets 401 / DeviceFlowUnsupported / device code
  expired, or mentions AE host / bi.forevernine.net login.
---

# ae-cli auth (ForeverNine)

## Canonical host

```text
https://bi.forevernine.net
```

CLI automatically appends `/agent` for device auth and the activate page.
Do **not** set host to any of these (they break authorize/token or return HTML):

- `https://bi.forevernine.net/agent/ae-cli`
- `https://bi.forevernine.net/agent`
- paths ending in `/ae-cli`

Check first:

```bash
ae-cli auth status
ae-cli config current
```

If active host is wrong:

```bash
ae-cli config set-host https://bi.forevernine.net
# or pass --host on every auth command
```

## Agent split-flow (required in Cursor)

Do **not** run blocking `ae-cli auth login` from the agent (it waits on the browser).

1. Request code:

```bash
ae-cli auth login --host https://bi.forevernine.net --no-wait
```

2. Show the user `verification_url` and `user_code`. Tell them to open the link in **system Chrome/Edge** (not Cursor’s browser). Code expires in ~300s.

3. After the user confirms authorization, resume with the **same** `--host`:

```bash
ae-cli auth login --host https://bi.forevernine.net --device-code <device_code>
ae-cli auth status --host https://bi.forevernine.net
```

`--device-code` without `--host` uses `activeHost`. If activeHost is still the old `/agent/ae-cli` value, token polling hits a wrong path and returns “Token response is not valid JSON”.

## Local terminal (human)

```bash
ae-cli auth login --host https://bi.forevernine.net
# headless / no auto-open:
ae-cli auth login --host https://bi.forevernine.net --no-browser
```

## Errors

| Symptom | Fix |
|---------|-----|
| `does not support device code login` | Wrong host (HTML/404). Use `https://bi.forevernine.net`. |
| `Token response is not valid JSON` | Resume with `--host https://bi.forevernine.net`. |
| `Device code has expired` | Restart from `--no-wait`; do not reuse old code. |
| `authenticated: false` | Re-run split-flow; confirm `config current` host. |

## After success

Expect:

- `auth status` → `authenticated: true`, `host: https://bi.forevernine.net`
- `config current` → `activeHost: https://bi.forevernine.net`

Logout:

```bash
ae-cli auth logout --host https://bi.forevernine.net
```
