# @phaser/game-agent

Connect your **own** coding agent to the **Phaser Game Agent** and build Phaser games on a
private cloud workspace — your subscription drives the model, your Phaser account owns the
workspace.

```bash
npx @phaser/game-agent            # one-shot: detect your CLIs → pick → sign in → configure
```

That's the whole thing: it finds the coding-agent CLIs you have installed, lets you pick,
signs you in (browser), and writes each one's MCP config. Then restart the CLI and check it's
wired up: *"Check my Phaser Game Agent account"* (calls `phaser_game_agent_hello` — greets you
by name with your credit balance). Once that works, build: *"use the Phaser Game Agent — open a
project and build me a Breakout clone, then preview it."* It should call `phaser_game_agent_guide`
first.

Running `phaser-game-agent` again while signed in shows who you're logged in as, your credit
balance, and a menu to reconfigure CLIs, refresh your token, buy credits, or log out.

### Commands

```bash
npx @phaser/game-agent login      # browser sign-in (or --token <t>) → stores your token
npx @phaser/game-agent setup      # write MCP config (--tool <id>|all, else detect + pick)
npx @phaser/game-agent manual     # print copy-paste MCP config for ANY non-listed client
npx @phaser/game-agent status     # who you are, access, and which CLIs are configured
npx @phaser/game-agent logout     # remove the token + every MCP config entry
```

### Using a client we don't list

Any MCP-compatible client works — `manual` prints the server entry pre-filled with your token in
both shapes: a **native remote-HTTP** entry (for clients that speak Streamable-HTTP MCP with an
auth header, like Claude Code / VS Code) and the **stdio bridge** entry (works with every client),
including the Codex/TOML form. Paste it under your client's MCP key (`mcpServers`, `servers`, or
`mcp_servers`), restart, and ask: *"Check my Phaser Game Agent account."*

### Supported CLIs

| CLI | `--tool` | Transport |
|---|---|---|
| Claude Code / Desktop | `claude-code` | native HTTP MCP (Desktop agent mode shares this config) |
| VS Code | `vscode` | native HTTP MCP (Copilot Chat, Agent mode) |
| Codex | `codex` | stdio bridge |
| Cursor | `cursor` | stdio bridge |
| Google Antigravity | `antigravity` | stdio bridge |
| Gemini CLI | `gemini-cli` | stdio bridge |
| Qoder | `qoder` | stdio bridge *(experimental)* |
| Windsurf | `windsurf` | stdio bridge *(experimental)* |

Claude Code speaks remote MCP directly. Every other CLI is configured with a tiny **stdio
bridge** (the bundled `bridge.mjs`) that forwards its stdio JSON-RPC to our hosted HTTP MCP —
a shape virtually every MCP client accepts, and the reason new CLIs are cheap to add. Each CLI
is **one row** in [`targets.mjs`](./targets.mjs); *experimental* means the config path/key come
from the tool's docs but we haven't yet confirmed the tools load after a restart (please report).

> **Install globally for the bridge's sake.** The bridge-based CLIs store an absolute path to
> `bridge.mjs`. With `npm i -g @phaser/game-agent` that path is stable; pure `npx` keeps it in a
> cache that can be cleared. Use the one-shot `npx` to get started, then `npm i -g @phaser/game-agent`
> if you rely on Codex/Cursor/etc.

## Options

| Flag / env | Purpose |
|---|---|
| `login --token <t>` | Skip the browser; paste a token from your account page. |
| `setup --tool <id>` / `--tool all` | Configure one CLI (or every one we know). `claude` resolves to `claude-code`. |
| `--mcp-url <url>` / `PHASER_AGENT_MCP_URL` | Point at a non-default MCP endpoint. |
| `PHASER_SITE_URL` | Point at a non-default site (token verification / sign-in). |

Default endpoint: `https://mcp.phaser.io/agent/mcp`.

## Also: a Skill

A thin `phaser-game-agent` [SKILL.md](./skills/phaser-game-agent/SKILL.md) ships alongside, so
agents that use the open Agent-Skills ecosystem can discover it. It can't register the MCP by
itself — its body tells the agent to run `npx @phaser/game-agent` to wire it up.

## Develop / test

Zero dependencies — Node built-ins only.

```bash
node targets.test.mjs                       # writer fixtures (merge preserves user config, idempotent)
node index.mjs status                       # run without installing

npm pack --dry-run                          # confirm the published file list
npm pack && npm i -g ./phaser-game-agent-*.tgz   # exercise the real artifact
npm rm -g @phaser/game-agent                # clean up
```

To add a CLI: add a row to `targets.mjs` (id, name, format, file path, serversKey, transport),
then verify by restarting that CLI and confirming the Phaser Game Agent tools appear.

> Interactive flows use a single shared readline. Test menus against a **pty** (e.g. Python
> `pty.fork`), not `printf | node` — forcing a TTY on a pipe gives readline false EOFs.

## Publish (maintainers)

```bash
npm pack --dry-run     # confirm the file list (index.mjs, targets.mjs, bridge.mjs, skills/, NOTICE.md, LICENSE)
npm publish            # scoped public (publishConfig.access=public); needs @phaser org rights
```

Prior art: the detect-then-configure approach is informed by
[vercel-labs/skills](https://github.com/vercel-labs/skills) (MIT) — see [NOTICE.md](./NOTICE.md).
