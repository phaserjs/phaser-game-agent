# How it works

You don't strictly need any of this to use the tool, but if you like knowing what's writing to
your machine and why, here it is.

## The chain

```
your editor / coding agent
        │   (MCP: JSON-RPC over one of two transports)
        ▼
Phaser Game Agent MCP server   ──►   your private cloud workspace
   https://mcp.phaser.io/agent/mcp   (a sandbox tied to your Phaser account)
```

Your agent speaks the **Model Context Protocol (MCP)**. The Phaser Game Agent is a *hosted* MCP
server. When you tell your agent to build a game, it calls tools on that server
(`phaser_game_agent_open_project`, `..._write_files`, `..._preview`, and so on), which drive a
cloud sandbox that compiles and previews your Phaser game. Builds land in your Phaser account
library — same DB as a game built on the website, with versions and analytics.

**Your subscription, your workspace.** The model that does the thinking is *your* coding agent on
*your* plan. The workspace and the games belong to *your* Phaser account. The CLI just introduces
the two.

## The two transports

Every MCP client speaks one of two dialects, and that's the only real branch in how editors get
configured:

### 1. Native remote HTTP

Some clients speak remote Streamable-HTTP MCP directly, sending an `Authorization: Bearer <token>`
header. For these we write a direct HTTP entry — **no bridge, no local process**:

```json
{
  "type": "http",
  "url": "https://mcp.phaser.io/agent/mcp",
  "headers": { "Authorization": "Bearer pga_…" }
}
```

Today that's **Claude Code** and **VS Code** (Copilot).

### 2. The stdio bridge

Most editors only know how to launch a local command that speaks MCP over stdin/stdout. For those
we write an entry that runs the bundled **`bridge.mjs`** — a tiny stdio-to-HTTP proxy that forwards
your editor's JSON-RPC to the hosted server, carrying your token in an environment variable:

```json
{
  "command": "/path/to/node",
  "args": ["/path/to/bridge.mjs"],
  "env": {
    "PHASER_AGENT_MCP_URL": "https://mcp.phaser.io/agent/mcp",
    "PHASER_GAME_AGENT_TOKEN": "pga_…"
  }
}
```

This shape is accepted by virtually every MCP client, which is why adding a new editor is usually a
one-line change. The bridge is why a **global install** matters for these editors — the path in the
config points at wherever `bridge.mjs` lives.

> Because the bridge stores an absolute path to `bridge.mjs`, install globally
> (`npm i -g @phaserjs/game-agent`) so that path stays valid. A pure `npx` cache can be cleared out
> from under it.

## Authentication

- Sign-in opens your browser and returns a token, stored locally at
  `~/.config/phaser-game-agent/config.json` (permissions `0600`). You can also paste one with
  `login --token <t>`.
- That token is what gets written into each editor's config (as a Bearer header, or as
  `PHASER_GAME_AGENT_TOKEN` for the bridge).
- **The server requires the token even to list tools.** A URL-only add in some editor's UI, with no
  auth header, will list nothing and do nothing — it must carry the token.
- Tokens are long-lived. Signing in again mints a *new* token; the CLI automatically re-pushes it
  into every editor you've already configured so nothing drifts out of sync.

## What the CLI writes, and where

The CLI only ever adds/updates **one** MCP server, named `phaser-game-agent`, inside your editor's
existing config. It shallow-merges — your other MCP servers and settings are left untouched — and
writes a `*.bak-pga` backup of the file first.

Each editor's exact config path is in [Connecting your editor](./connecting-editors.md). Nothing is
written anywhere else except your token in `~/.config/phaser-game-agent/`.

`logout` removes the `phaser-game-agent` entry from every editor and clears your stored token. (To
fully revoke a token server-side, do it from your Phaser account settings.)

## Credits

Building runs a cloud sandbox, which is metered against your Phaser credits. Ask your agent about
credits any time (*"show my credits"* → the `phaser_game_agent_show_credits` tool) for your balance,
recent activity, and a buy-more link. The CLI's own menu shows the same under **Show Credits Balance
and Transactions**.
