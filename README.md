# ollama-cloud-usage

Monitor your Ollama Cloud session/weekly quota from the terminal. Reads quota
state from `/api/balance` (session and weekly remaining percentages plus
authoritative reset times) and request counts from `/api/usage`, shows a live
dashboard, and logs history to a JSONL file.

## Install

```sh
npm install -g ollama-cloud-usage
```

## Usage

```sh
ollama-cloud-usage [--baseline <sec>] [--fine <sec>] [--window <min>]
```

All flags are named and can be given in any order.

- `--baseline <sec>` — idle polling interval (default `300` = 5 min)
- `--fine <sec>` — near-boundary polling interval (default `30`)
- `--window <min>` — half-window around each reset boundary (default `5`)

### Interactive commands

| key | action |
|-----|--------|
| `r` | refresh usage now |
| `q` | quit |
| `?` | show help |

## API key

The key is resolved by precedence:

1. `OLLAMA_API_KEY` env var
2. `~/.local/share/opencode/auth.json` → `ollama-cloud.key` (opencode users)

The key is never logged or written to disk by this tool.

## Quota and reset times

Quota state comes from `/api/balance`, which reports `remaining_percent` and
`resets_at` for the session and weekly windows. The reset times are
server-authoritative — the tool does not infer them.

- **Session**: rolling 5-hour window (the anchor drifts through the day, since
  24h is not divisible by 5h).
- **Weekly**: Monday 00:00 UTC.

Accounts on credit plans (no session/weekly limits) instead get
`balance_usd` / `allowance_usd`, which the dashboard shows as remaining credit.

## Log

Snapshots are appended to `./ollama-usage.jsonl` (one JSON object per line), or
the path in `OLLAMA_USAGE_LOG`. Each line:

```json
{"timestamp":"...","session":{"used_percent":3.91,"remaining_percent":96.09,"resets_at":"2026-10-27T08:00:00Z"},"weekly":{"used_percent":16.67,"remaining_percent":83.33,"resets_at":"2026-11-02T00:00:00Z"},"purchased":{"balance_usd":0},"usage":{"range":"7d","totals":{"request_count":29012}}}
```

The log never contains the API key or per-request content.

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
