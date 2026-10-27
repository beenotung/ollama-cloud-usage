import fs from "fs"
import os from "os"
import path from "path"

// Resolve the ollama cloud API key by precedence:
//   1. OLLAMA_API_KEY env var (works for anyone, CI, etc.)
//   2. ~/.local/share/opencode/auth.json -> ollama-cloud.key   (OpenCode 1)
//   3. ~/.local/share/opencode/opencode.db -> credential row   (OpenCode 2)
//   4. anything else: clear error
// The key is never logged or written to disk by this tool.
export function loadKey(): string {
  let env = process.env.OLLAMA_API_KEY
  if (env) return env

  let fromAuthJson = keyFromAuthJson()
  if (fromAuthJson) return fromAuthJson

  let fromDb = keyFromOpenCodeDb()
  if (fromDb) return fromDb

  throw new Error(
    "No ollama cloud API key found. Set OLLAMA_API_KEY, or store it in " +
      "~/.local/share/opencode/auth.json ('ollama-cloud'.key) or the " +
      "OpenCode database (credential where integration_id = 'ollama-cloud').",
  )
}

function keyFromAuthJson(): string | null {
  let authPath = path.join(os.homedir(), ".local", "share", "opencode", "auth.json")
  try {
    let auth = JSON.parse(fs.readFileSync(authPath, "utf8"))
    let key = auth["ollama-cloud"] && auth["ollama-cloud"].key
    if (typeof key === "string" && key) return key
  } catch {
    // fall through
  }
  return null
}

// OpenCode 2 stores credentials in SQLite. Prefer the built-in node:sqlite
// (Node >= 22, no external binary); fall back to the sqlite3 CLI if present.
function keyFromOpenCodeDb(): string | null {
  let dbPath = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db")
  if (!fs.existsSync(dbPath)) return null

  let query =
    "select value from credential where integration_id = 'ollama-cloud' " +
    "order by time_updated desc limit 1"

  try {
    let { DatabaseSync } = require("node:sqlite")
    let db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      let row = db.prepare(query).get()
      if (row && row.value) return extractKey(row.value)
    } finally {
      db.close()
    }
  } catch {
    // node:sqlite unavailable; try the CLI below
  }

  try {
    let { execFileSync } = require("child_process")
    let out = execFileSync("sqlite3", ["-readonly", "-json", dbPath, query], {
      encoding: "utf8",
    })
    let rows = JSON.parse(out || "[]")
    if (rows.length > 0 && rows[0].value) return extractKey(rows[0].value)
  } catch {
    // no sqlite3 binary either
  }

  return null
}

// The stored value is JSON like {"type":"api_key","key":"..."}; older entries
// may be the raw key.
function extractKey(value: string): string | null {
  try {
    let parsed = JSON.parse(value)
    if (parsed && typeof parsed.key === "string" && parsed.key) return parsed.key
  } catch {
    // not JSON: treat as a raw key
  }
  return value || null
}
