# Getting started

## What you need

- **Node.js 20+** (the CLI is zero-dependency — Node built-ins only).
- One or more supported coding agents installed (see [Connecting your editor](./connecting-editors.md)).
- A **Phaser account** with agent access — i.e. a subscription or credits. You'll sign in during
  setup; if you have no access yet the CLI will tell you and point you at the buy-credits page.

## Install & connect (the one-shot)

The fastest path is the interactive one-shot. It detects your editors, lets you pick, signs you
in, and writes the config for each:

```bash
npx @phaserjs/game-agent
```

What happens:

1. **Detect** — it finds the coding-agent CLIs/editors you have installed.
2. **Pick** — choose which to configure (or `all`).
3. **Sign in** — your browser opens to authorize; the token is stored locally at
   `~/.config/phaser-game-agent/config.json`. (No browser? Use `login --token <t>` — see the
   [CLI reference](./cli-reference.md).)
4. **Configure** — it writes the MCP server entry into each editor's config file.

> **Install it globally if you use a bridge-based editor** (Codex, Cursor, Gemini CLI, Antigravity,
> Qoder, Windsurf). Those store an absolute path to the bundled `bridge.mjs`; a global install keeps
> that path stable:
>
> ```bash
> npm install -g @phaserjs/game-agent
> ```
>
> Claude Code and VS Code talk to the server directly (no bridge), so they don't need this — but a
> global install never hurts.

## Restart your editor

MCP servers are read at startup. **Restart the editor/CLI you just configured** or it won't see
the new server.

## Verify it's working

Ask your agent:

> **"Check my Phaser Game Agent account"**

It should greet you by name and report your credit balance. That single call proves the whole
chain works — the tool loaded, your token is valid, and the server answered. (Under the hood
that's the `phaser_game_agent_hello` tool.)

If nothing happens, see [Troubleshooting](./troubleshooting.md).

## Build your first game

Once the account check works, just describe what you want:

> **"use the Phaser Game Agent — open a project and build me a Breakout clone, then preview it."**

Your agent will call `phaser_game_agent_guide` first to learn the workflow, then open a project,
build, and hand you a preview URL. The game lives in your Phaser account library with versions and
play analytics, exactly as if it were built on the website.

## Coming back later

Run `phaser-game-agent` again any time. When you're already signed in it shows who you're logged
in as and gives you a menu to:

- **Configure / update** your coding agents (including a *"Configure a CLI not on this list"*
  option for anything we don't list yet)
- **Refresh your token** across everything you've already configured
- **Show credits** balance and transactions, with a buy-more link
- **Log out**

See the [CLI reference](./cli-reference.md) for the non-interactive commands.
