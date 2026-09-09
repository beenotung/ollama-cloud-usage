import fs from "fs"
import os from "os"
import path from "path"

// Resolve the ollama cloud API key by precedence:
//   1. OLLAMA_API_KEY env var (works for anyone, CI, etc.)
//   2. ~/.local/share/opencode/auth.json -> ollama-cloud.key (opencode users)
// The key is never logged or written to disk by this tool.
export function loadKey(): string {
  let env = process.env.OLLAMA_API_KEY
  if (env) return env

  let authPath = path.join(os.homedir(), ".local", "share", "opencode", "auth.json")
  try {
    let auth = JSON.parse(fs.readFileSync(authPath, "utf8"))
    let key = auth["ollama-cloud"] && auth["ollama-cloud"].key
    if (key) return key
  } catch {
    // fall through to error below
  }

  throw new Error(
    "No ollama cloud API key found. Set OLLAMA_API_KEY, or add it to " +
      "~/.local/share/opencode/auth.json under 'ollama-cloud'.key",
  )
}
