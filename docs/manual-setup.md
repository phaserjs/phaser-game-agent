# Connecting any other MCP client (manual setup)

If your editor isn't in the [supported list](./connecting-editors.md), you can still connect it —
any MCP-compatible client works. There are only two shapes to know, and the CLI will print both,
pre-filled with your token, for you to copy-paste.

## Print your config

```bash
phaser-game-agent manual
```

(You need to be signed in first — run `phaser-game-agent login` if you haven't.) This prints both
transport shapes, filled in with your token and the correct bridge path. Then restart your client
and ask it: *"Check my Phaser Game Agent account."*

## Which key does my client use?

You add **one** MCP server named `phaser-game-agent`. The container key varies by client:

| Key | Clients | Format |
|---|---|---|
| `mcpServers` | Cursor, Windsurf, most VS Code AI forks, Claude | JSON |
| `servers` | native VS Code (Copilot) | JSON |
| `mcp_servers` | Codex | TOML |

## Shape A — native remote HTTP

For clients that speak remote Streamable-HTTP MCP with an `Authorization` header (e.g. Claude Code,
VS Code). No bridge, no local process:

```json
{
  "mcpServers": {
    "phaser-game-agent": {
      "type": "http",
      "url": "https://mcp.phaser.io/agent/mcp",
      "headers": { "Authorization": "Bearer pga_YOUR_TOKEN" }
    }
  }
}
```

(Swap `mcpServers` for `servers` if your client uses that key.)

## Shape B — stdio bridge (works with every client)

For clients that launch a local command and speak MCP over stdio. This runs the bundled
`bridge.mjs`, which proxies to the hosted server and passes your token via an environment variable:

```json
{
  "mcpServers": {
    "phaser-game-agent": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/bridge.mjs"],
      "env": {
        "PHASER_AGENT_MCP_URL": "https://mcp.phaser.io/agent/mcp",
        "PHASER_GAME_AGENT_TOKEN": "pga_YOUR_TOKEN"
      }
    }
  }
}
```

The exact `node` and `bridge.mjs` paths for **your** machine are what `phaser-game-agent manual`
prints — copy them from there. They point at your global install, so keep it installed
(`npm i -g @phaserjs/game-agent`).

### TOML form (Codex-style clients)

```toml
[mcp_servers.phaser-game-agent]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/bridge.mjs"]

[mcp_servers.phaser-game-agent.env]
PHASER_AGENT_MCP_URL = "https://mcp.phaser.io/agent/mcp"
PHASER_GAME_AGENT_TOKEN = "pga_YOUR_TOKEN"
```

## Which shape should I use?

- If your client offers a **"remote / HTTP MCP server"** option → use **Shape A**.
- Otherwise → use **Shape B** (the bridge). It works everywhere.

## Where do I get the token?

`phaser-game-agent manual` embeds it for you. If you need it directly, it's stored (after
`phaser-game-agent login`) at `~/.config/phaser-game-agent/config.json` under `"token"`, or you
can copy one from your Phaser account page and use it verbatim.

## Common pitfall: URL without a token

The Phaser Game Agent server **requires the token even to list tools** — an unauthenticated request
gets a 401. So if you add the server in a client's UI with only a URL and no auth header, it will
list nothing and do nothing. Make sure the `Authorization` header (Shape A) or
`PHASER_GAME_AGENT_TOKEN` env var (Shape B) is present.

## Verify

Restart the client and ask its agent: *"Check my Phaser Game Agent account."* A greeting with your
name and credit balance means it's working. If it worked, we'd love a
[report](https://github.com/phaserjs/phaser-game-agent/issues) so we can add your client as a
first-class target.
