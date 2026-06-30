// targets.mjs — the per-CLI MCP-config registry + generic writers.
//
// Each row knows where one coding-agent CLI keeps its MCP config, the file FORMAT, the
// KEY that holds servers, and how to express our hosted Phaser Game Agent MCP as a server
// entry. Two transports:
//   • remoteMcp:true  → a direct HTTP entry (only where the CLI proves it speaks remote
//     Streamable-HTTP MCP *with* an auth header — today: Claude Code).
//   • remoteMcp:false → a stdio entry that launches our bridge.mjs (token via env). This
//     shape ({command,args,env}) is near-universal across MCP clients and ALWAYS works
//     against our HTTP endpoint, so it's the safe default for every other CLI.
//
// Adding a CLI = ONE row here, then verify by restarting that CLI and confirming the
// phaser_game_agent / pga_* tools appear (`detect()` can't validate schema correctness).
// `verified:true` = we've confirmed the tools load; `false` = best-effort, path/key from
// docs, transport is the universal bridge so the risk is only the path/key.
//
// Design borrowed (idea only, no code) from vercel-labs/skills' table-driven agent
// registry. See NOTICE.md.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = homedir();
const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = resolve(HERE, "bridge.mjs");
export const SERVER_KEY = "phaser-game-agent"; // the MCP server id written into every config
const envv = (k) => (process.env[k] || "").trim();

// True if any of `names` is an executable on PATH — the right way to detect a CLI tool
// (a config dir can be a leftover or, like ~/.gemini, shared with another product).
function onPath(...names) {
  const dirs = (process.env.PATH || "").split(delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  return dirs.some((d) => names.some((n) => exts.some((e) => { try { return existsSync(join(d, n + e)); } catch { return false; } })));
}

// The stdio entry every bridge-based CLI uses (JSON form). TOML CLIs get the same data
// rendered as a [table] by writeToml().
const bridgeStdio = ({ token, mcpUrl }) => ({
  command: process.execPath,
  args: [BRIDGE],
  env: { PHASER_AGENT_MCP_URL: mcpUrl, PHASER_GAME_AGENT_TOKEN: token },
});

// ── the registry ───────────────────────────────────────────────────────────────
// file()  → absolute path to the CLI's MCP config (honoring its own $ENV override)
// detect()→ is this CLI present? (config dir/file exists)
export const TARGETS = [
  {
    // Also covers Claude DESKTOP's agent mode, which reads this same ~/.claude.json.
    id: "claude-code",
    name: "Claude Code / Desktop",
    format: "json",
    verified: true,
    remoteMcp: true, // native Streamable-HTTP MCP with an Authorization header
    serversKey: "mcpServers",
    file: () => join(envv("CLAUDE_CONFIG_DIR") || HOME, ".claude.json"),
    detect() { return existsSync(this.file()); },
    entry: ({ token, mcpUrl }) => ({ type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${token}` } }),
  },
  // NOTE: no separate "Claude Desktop" target. Claude Desktop's agent mode reads ~/.claude.json
  // (the claude-code target above) — proven: a Desktop agent session has the MCP loaded while its
  // own claude_desktop_config.json has no mcpServers. The desktop config-file route would only
  // reach classic Desktop chat, not the agentic build loop, so configuring claude-code covers it.
  {
    id: "codex",
    name: "Codex",
    format: "toml",
    verified: true,
    remoteMcp: false, // stdio-only client → bridge
    serversKey: "mcp_servers",
    file: () => join(envv("CODEX_HOME") || join(HOME, ".codex"), "config.toml"),
    detect() { return existsSync(this.file()) || existsSync("/Applications/Codex.app"); },
    entry: bridgeStdio,
    tomlExtra: { startup_timeout_sec: 120 }, // rendered as a scalar in the [table]
  },
  // ── best-effort below: file path + serversKey from each tool's docs; transport is the
  //    universal stdio bridge, so the only thing to confirm is that the path/key are right.
  {
    id: "cursor",
    name: "Cursor",
    format: "json",
    verified: true,
    remoteMcp: false,
    serversKey: "mcpServers",
    file: () => join(HOME, ".cursor", "mcp.json"),
    detect() { return existsSync(join(HOME, ".cursor")); },
    entry: bridgeStdio,
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    format: "json",
    verified: true,
    remoteMcp: false,
    serversKey: "mcpServers",
    file: () => join(envv("GEMINI_DIR") || join(HOME, ".gemini"), "settings.json"),
    // The `gemini` binary on PATH — NOT ~/.gemini, which Antigravity also creates (false positive).
    detect() { return onPath("gemini"); },
    entry: bridgeStdio,
  },
  {
    // Antigravity — Google's agentic IDE. Shares the ~/.gemini home with the Gemini CLI but
    // keeps its MCP config in its OWN file (config/mcp_config.json), so they don't collide.
    // CONFIRMED working: it reads mcpServers from this file and runs the stdio bridge (which
    // carries the token) — verified by an authenticated tool call on a clean CLI-only setup.
    // Note: Antigravity ALSO has a per-tool "MCP Tools" allow-list in config.json
    // (server/tool grants) that IT manages via approval prompts — we must NOT write that.
    id: "antigravity",
    name: "Google Antigravity",
    format: "json",
    verified: true,
    remoteMcp: false,
    serversKey: "mcpServers",
    file: () => join(envv("GEMINI_DIR") || join(HOME, ".gemini"), "config", "mcp_config.json"),
    detect() {
      // The Antigravity EDITOR binary — not the ~/.gemini/antigravity state dir, which
      // survives an uninstall (the Windsurf false-positive lesson).
      if (process.platform === "darwin") return existsSync("/Applications/Antigravity.app");
      if (process.platform === "win32") {
        const LA = envv("LOCALAPPDATA") || join(HOME, "AppData", "Local");
        const PF = envv("PROGRAMFILES") || "C:\\Program Files";
        return existsSync(join(LA, "Programs", "Antigravity", "Antigravity.exe")) || existsSync(join(PF, "Antigravity", "Antigravity.exe"));
      }
      return existsSync(join(HOME, ".gemini", "antigravity"));
    },
    entry: bridgeStdio,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    format: "json",
    verified: false,
    remoteMcp: false,
    serversKey: "mcpServers",
    file: () => join(HOME, ".codeium", "windsurf", "mcp_config.json"),
    // Detect the Windsurf EDITOR by its binary — NOT ~/.codeium/windsurf, which Codeium's
    // other products also create and which survives an uninstall (a false positive: you see
    // Windsurf offered after you've removed it). Falls back to choosing it explicitly.
    detect() {
      if (process.platform === "darwin") return existsSync("/Applications/Windsurf.app");
      if (process.platform === "win32") {
        const LA = envv("LOCALAPPDATA") || join(HOME, "AppData", "Local");
        const PF = envv("PROGRAMFILES") || "C:\\Program Files";
        return existsSync(join(LA, "Programs", "Windsurf", "Windsurf.exe")) || existsSync(join(PF, "Windsurf", "Windsurf.exe"));
      }
      return existsSync("/usr/share/windsurf") || existsSync(join(HOME, ".local", "share", "windsurf"));
    },
    entry: bridgeStdio,
  },
  {
    // Qoder — an agentic IDE built on VS Code. Like the other VS Code AI forks it runs its own
    // Cursor-style MCP layer (mcpServers + stdio), confirmed on disk — NOT VS Code's native
    // `servers` format — but keeps it in its own file under SharedClientCache. Detect via the
    // binary (the app-data dir survives an uninstall).
    id: "qoder",
    name: "Qoder",
    format: "json",
    verified: false,
    remoteMcp: false,
    serversKey: "mcpServers",
    file: () => {
      if (process.platform === "darwin") return join(HOME, "Library", "Application Support", "Qoder", "SharedClientCache", "mcp.json");
      if (process.platform === "win32") return join(envv("APPDATA") || join(HOME, "AppData", "Roaming"), "Qoder", "SharedClientCache", "mcp.json");
      return join(envv("XDG_CONFIG_HOME") || join(HOME, ".config"), "Qoder", "SharedClientCache", "mcp.json");
    },
    detect() {
      if (process.platform === "darwin") return existsSync("/Applications/Qoder.app");
      if (process.platform === "win32") return existsSync(join(envv("LOCALAPPDATA") || join(HOME, "AppData", "Local"), "Programs", "Qoder", "Qoder.exe"));
      return existsSync(join(HOME, ".qoder"));
    },
    entry: bridgeStdio,
  },
  {
    // VS Code — NATIVE MCP (distinct from the AI forks above, which run their own mcpServers
    // layer). VS Code uses the `servers` key and speaks remote Streamable-HTTP with an
    // Authorization header, so no bridge — we write a direct http entry like Claude Code.
    // VERIFIED: User mcp.json picked up by Copilot Chat (Agent mode); tools load + auth.
    // Note: the panel in the Claude Code extension reads .mcp.json, NOT this — check via
    // Copilot's "MCP: List Servers" / Agent mode, not the Claude extension's MCP list.
    id: "vscode",
    name: "VS Code",
    format: "json",
    verified: true,
    remoteMcp: true,
    serversKey: "servers",
    file: () => {
      if (process.platform === "darwin") return join(HOME, "Library", "Application Support", "Code", "User", "mcp.json");
      if (process.platform === "win32") return join(envv("APPDATA") || join(HOME, "AppData", "Roaming"), "Code", "User", "mcp.json");
      return join(envv("XDG_CONFIG_HOME") || join(HOME, ".config"), "Code", "User", "mcp.json");
    },
    // Detect the EDITOR — by the `code` CLI shim if it's on PATH, but ALSO by the app
    // itself, because on macOS the shim isn't installed until the user runs the
    // "Shell Command: Install 'code' command in PATH" palette action (a very common miss).
    detect() {
      if (onPath("code", "code-insiders")) return true;
      if (process.platform === "darwin") return existsSync("/Applications/Visual Studio Code.app") || existsSync("/Applications/Visual Studio Code - Insiders.app");
      if (process.platform === "win32") {
        const LA = envv("LOCALAPPDATA") || join(HOME, "AppData", "Local");
        const PF = envv("PROGRAMFILES") || "C:\\Program Files";
        return existsSync(join(LA, "Programs", "Microsoft VS Code", "Code.exe")) || existsSync(join(PF, "Microsoft VS Code", "Code.exe"));
      }
      return false;
    },
    entry: ({ token, mcpUrl }) => ({ type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${token}` } }),
  },
];

export const byId = (id) => TARGETS.find((t) => t.id === id);
export const detectInstalled = () => TARGETS.filter((t) => { try { return t.detect(); } catch { return false; } });

function backup(file) { try { if (existsSync(file)) copyFileSync(file, file + ".bak-pga"); } catch { /* non-fatal */ } }

// ── JSON: shallow-merge OUR server under serversKey; never touch other keys/servers ──
function writeJson(t, vals) {
  const file = t.file();
  let cfg = {};
  if (existsSync(file)) {
    // An empty / whitespace-only file is not invalid JSON — some tools ship an empty
    // mcp_config.json placeholder (e.g. Antigravity). Treat it as a fresh {}; only a
    // file with actual non-JSON content is an error.
    const raw = readFileSync(file, "utf8").trim();
    if (raw) { try { cfg = JSON.parse(raw) || {}; } catch { throw new Error(`${t.name}: ${file} is not valid JSON — fix or remove it, then retry`); } }
  }
  cfg[t.serversKey] = cfg[t.serversKey] || {};
  cfg[t.serversKey][SERVER_KEY] = t.entry(vals);
  backup(file);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  return file;
}
function removeJson(t) {
  const file = t.file();
  if (!existsSync(file)) return false;
  let cfg; try { cfg = JSON.parse(readFileSync(file, "utf8")); } catch { return false; }
  if (cfg?.[t.serversKey]?.[SERVER_KEY]) { delete cfg[t.serversKey][SERVER_KEY]; backup(file); writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n"); return true; }
  return false;
}
function hasJson(t) {
  const file = t.file();
  if (!existsSync(file)) return false;
  try { return !!JSON.parse(readFileSync(file, "utf8"))?.[t.serversKey]?.[SERVER_KEY]; } catch { return false; }
}

// ── TOML: line-based replace of OUR [serversKey.SERVER_KEY] table (+ its .env subtable);
//    every other table is preserved verbatim (no TOML parser → zero deps). ──
const tomlHead = (key) => new RegExp(`^\\[${key.replace(/\./g, "\\.")}\\.${SERVER_KEY}(\\]|\\.)`);
function stripTomlBlock(txt, key) {
  const head = tomlHead(key);
  const out = []; let skip = false, found = false;
  for (const ln of txt.split("\n")) {
    if (head.test(ln.trim())) { skip = true; found = true; continue; }
    if (skip && /^\[/.test(ln.trim())) skip = false; // next (non-ours) table ends the skip
    if (!skip) out.push(ln);
  }
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd(), found };
}
function writeToml(t, vals) {
  const file = t.file();
  const txt = existsSync(file) ? readFileSync(file, "utf8") : "";
  const { body } = stripTomlBlock(txt, t.serversKey);
  const e = t.entry(vals); // { command, args, env }
  const extra = Object.entries(t.tomlExtra || {}).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join("\n");
  const block =
    `[${t.serversKey}.${SERVER_KEY}]\n` +
    `command = ${JSON.stringify(e.command)}\n` +
    `args = ${JSON.stringify(e.args)}\n` +
    (extra ? extra + "\n" : "") +
    `\n[${t.serversKey}.${SERVER_KEY}.env]\n` +
    Object.entries(e.env).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join("\n") + "\n";
  backup(file);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, (body ? body + "\n\n" : "") + block);
  return file;
}
function removeToml(t) {
  const file = t.file();
  if (!existsSync(file)) return false;
  const { body, found } = stripTomlBlock(readFileSync(file, "utf8"), t.serversKey);
  if (found) writeFileSync(file, body ? body + "\n" : "");
  return found;
}
function hasToml(t) {
  const file = t.file();
  if (!existsSync(file)) return false;
  const head = tomlHead(t.serversKey);
  return readFileSync(file, "utf8").split("\n").some((l) => head.test(l.trim()));
}

// ── format-dispatching public API ──
export function writeTarget(t, vals) { return t.format === "toml" ? writeToml(t, vals) : writeJson(t, vals); }
export function removeTarget(t) { return t.format === "toml" ? removeToml(t) : removeJson(t); }
export function isConfigured(t) { return t.format === "toml" ? hasToml(t) : hasJson(t); }
