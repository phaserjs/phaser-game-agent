# Connecting your editor

The easiest way is always the one-shot (`npx @phaserjs/game-agent`) which auto-detects and
configures for you. This page is the per-editor detail: the exact `--tool` id, where the config
gets written, the transport, and anything editor-specific to watch for.

To configure a single editor directly:

```bash
phaser-game-agent setup --tool <id>
```

Then **restart the editor** and verify with *"Check my Phaser Game Agent account."*

## At a glance

| Editor | `--tool` id | Transport | Status |
|---|---|---|---|
| Claude Code / Desktop | `claude-code` | native HTTP | ✅ verified |
| VS Code (Copilot) | `vscode` | native HTTP | ✅ verified |
| Codex | `codex` | stdio bridge | ✅ verified |
| Cursor | `cursor` | stdio bridge | ✅ verified |
| Gemini CLI | `gemini-cli` | stdio bridge | ✅ verified |
| Google Antigravity | `antigravity` | stdio bridge | ✅ verified |
| Qoder | `qoder` | stdio bridge | 🧪 experimental |
| Windsurf | `windsurf` | stdio bridge | 🧪 experimental |

**Native HTTP** editors talk to the server directly with an auth header — no local process.
**stdio bridge** editors run the bundled `bridge.mjs`; for those, install globally
(`npm i -g @phaserjs/game-agent`) so the bridge path stays stable. *Experimental* means the config
path/key come from the tool's docs but we haven't yet confirmed the tools load after a restart —
please [report back](https://github.com/phaserjs/phaser-game-agent/issues) if you try one.

Don't see your editor? Any MCP client works — see [Connecting any other client](./manual-setup.md).

---

## Claude Code / Desktop

- **id:** `claude-code` · **transport:** native HTTP
- **Config file:** `~/.claude.json` (override with `CLAUDE_CONFIG_DIR`), under the `mcpServers` key.

```bash
phaser-game-agent setup --tool claude-code
```

This also covers **Claude Desktop's agent mode**, which reads the same `~/.claude.json` — there's
no separate Desktop target. Restart Claude Code (or Desktop) and ask it to check your account.

---

## VS Code (Copilot)

- **id:** `vscode` · **transport:** native HTTP
- **Config file** (`servers` key):
  - macOS — `~/Library/Application Support/Code/User/mcp.json`
  - Windows — `%APPDATA%\Code\User\mcp.json`
  - Linux — `$XDG_CONFIG_HOME/Code/User/mcp.json` (usually `~/.config/Code/User/mcp.json`)

```bash
phaser-game-agent setup --tool vscode
```

You need **Copilot Chat in Agent mode** to actually call MCP tools. After restarting VS Code, open
Copilot Chat → Agent mode and ask it to check your account. To confirm the server is registered,
run **"MCP: List Servers"** from the Command Palette.

> **Gotcha:** if you have the *Claude Code VS Code extension* installed, its MCP panel lists servers
> from a workspace `.mcp.json` — that is **not** the same as Copilot's, and it won't show this
> server. Verify through Copilot's Agent mode / "MCP: List Servers", not the Claude extension's list.

---

## Codex

- **id:** `codex` · **transport:** stdio bridge (TOML config)
- **Config file:** `~/.codex/config.toml` (override with `CODEX_HOME`), under `[mcp_servers.phaser-game-agent]`.

```bash
phaser-game-agent setup --tool codex
```

The written entry includes `startup_timeout_sec = 120` so the bridge has time to connect on a cold
start. Install globally so the bridge path is stable, then restart Codex.

---

## Cursor

- **id:** `cursor` · **transport:** stdio bridge
- **Config file:** `~/.cursor/mcp.json`, under the `mcpServers` key.

```bash
phaser-game-agent setup --tool cursor
```

Install globally, restart Cursor, and ask its agent to check your account.

---

## Gemini CLI

- **id:** `gemini-cli` · **transport:** stdio bridge
- **Config file:** `~/.gemini/settings.json` (override with `GEMINI_DIR`), under `mcpServers`.

```bash
phaser-game-agent setup --tool gemini-cli
```

Detection is by the `gemini` binary on your PATH (the `~/.gemini` directory alone isn't enough — it
can be created by other Google tools). Install globally, restart, and check your account.

---

## Google Antigravity

- **id:** `antigravity` · **transport:** stdio bridge
- **Config file:** `~/.gemini/config/mcp_config.json`, under `mcpServers`.

```bash
phaser-game-agent setup --tool antigravity
```

Antigravity shares the `~/.gemini` home with the Gemini CLI but keeps its MCP config in its own
file, so they don't collide.

> **Gotcha:** Antigravity also has a per-tool **"MCP Tools"** allow-list in its own settings that it
> manages via approval prompts. The CLI deliberately does **not** touch that — if Antigravity asks
> you to approve the Phaser Game Agent's tools the first time, say yes. The bridge carries your
> token; that's all the config file needs.

---

## Qoder 🧪

- **id:** `qoder` · **transport:** stdio bridge · **experimental**
- **Config file** (`mcpServers` key):
  - macOS — `~/Library/Application Support/Qoder/SharedClientCache/mcp.json`
  - Windows — `%APPDATA%\Qoder\SharedClientCache\mcp.json`
  - Linux — `$XDG_CONFIG_HOME/Qoder/SharedClientCache/mcp.json`

```bash
phaser-game-agent setup --tool qoder
```

Qoder is a VS Code–based agentic IDE but runs its own Cursor-style MCP layer (not VS Code's native
`servers` format). Install globally, restart, and if it works, please let us know.

---

## Windsurf 🧪

- **id:** `windsurf` · **transport:** stdio bridge · **experimental**
- **Config file:** `~/.codeium/windsurf/mcp_config.json`, under `mcpServers`.

```bash
phaser-game-agent setup --tool windsurf
```

Only verifiable on a machine where the Windsurf *editor* is installed. Install globally, restart,
and report back.

---

## Verifying any editor

1. Run the `setup` command (or the one-shot).
2. **Restart the editor.**
3. Ask its agent: *"Check my Phaser Game Agent account."*

A greeting with your name and credit balance means you're connected. If not, head to
[Troubleshooting](./troubleshooting.md).
