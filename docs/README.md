# Phaser Game Agent — documentation

The **Phaser Game Agent** lets you build Phaser games from your *own* coding agent — Claude Code,
VS Code (Copilot), Codex, Cursor, Gemini CLI, and any other MCP-compatible client — running
against a private cloud workspace tied to your Phaser account. Your subscription drives the
model; your Phaser account owns the workspace and the games it builds.

The [`@phaserjs/game-agent`](https://www.npmjs.com/package/@phaserjs/game-agent) CLI is the
one-command installer that wires your editor up to it.

```bash
npx @phaserjs/game-agent
```

## Pages

| Page | What's in it |
|---|---|
| [Getting started](./getting-started.md) | Install, sign in, verify, and build your first game. |
| [How it works](./how-it-works.md) | The moving parts — MCP, the two transports, auth, and what gets written where. |
| [CLI reference](./cli-reference.md) | Every command, flag, and environment variable. |
| [Connecting your editor](./connecting-editors.md) | Per-editor setup: Claude Code, VS Code, Codex, Cursor, Gemini CLI, Antigravity, Qoder, Windsurf. |
| [Connecting any other client (manual)](./manual-setup.md) | Wire up any MCP client we don't list yet, by hand. |
| [Troubleshooting](./troubleshooting.md) | Tools not showing up, 401s, restarts, credits, and the usual gotchas. |

## The 60-second version

1. Run `npx @phaserjs/game-agent` — it detects your installed editors, lets you pick, signs you
   in via the browser, and writes each one's MCP config.
2. **Restart the editor.**
3. Ask your agent: *"Check my Phaser Game Agent account"* — it should greet you by name and show
   your credit balance. That confirms it's connected and authenticated.
4. Then: *"use the Phaser Game Agent — open a project and build me a Breakout clone, then preview
   it."*

Everything after that is just talking to your agent.
