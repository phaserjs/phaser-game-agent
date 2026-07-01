# CLI reference

Run via `npx @phaserjs/game-agent <command>`, or install globally
(`npm i -g @phaserjs/game-agent`) and call `phaser-game-agent <command>` directly. Zero
dependencies; needs Node 20+.

## Commands

| Command | What it does |
|---|---|
| `phaser-game-agent` | The one-shot. Signed out → detect editors → pick → sign in → configure. Signed in → shows your account + an interactive menu. |
| `phaser-game-agent login` | Browser sign-in (or `--token <t>`). Stores the token and re-pushes it to every already-configured editor. |
| `phaser-game-agent setup` | Write the MCP config into one or more editors (`--tool <id>`, `--tool all`, or detect + pick). |
| `phaser-game-agent manual` | Print copy-paste MCP config for **any** client we don't list. (Alias: `config`.) |
| `phaser-game-agent status` | Who you're signed in as, access + credit balance, and which editors are configured. |
| `phaser-game-agent logout` | Remove the `phaser-game-agent` entry from every editor and clear your stored token. |
| `phaser-game-agent help` | Usage summary. (Also `-h`, `--help`.) |

## The interactive menu

Running `phaser-game-agent` while signed in prints `Logged in as: <you>` and offers:

1. **Configure / update your coding agents** — detect + pick which editors to (re)write. The
   picker includes a *"Configure a CLI not on this list"* option (same output as `manual`) and a
   *"Return to menu"* option.
2. **Refresh your token across configured agents** — re-push your current token into everything
   already set up.
3. **Show Credits Balance and Transactions** — balance + recent activity, then an option to open
   the buy-credits page in your browser.
4. **Log out**
5. **Quit**

## Flags

| Flag | Applies to | Purpose |
|---|---|---|
| `--token <t>` | `login` | Skip the browser; paste a token from your account page. |
| `--tool <id>` | `setup` | Configure one editor by id (see the id column in [Connecting your editor](./connecting-editors.md)). `claude` resolves to `claude-code`. |
| `--tool all` | `setup` | Configure every editor the CLI knows about. |
| `--site <url>` | `login` | Use a non-default site for sign-in / token verification. |
| `--mcp-url <url>` | `login`, `setup` | Point the written config at a non-default MCP endpoint. |

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PHASER_AGENT_MCP_URL` | MCP endpoint written into configs. | `https://mcp.phaser.io/agent/mcp` |
| `PHASER_SITE_URL` | Site used for sign-in and token verification. | `https://phaser.io` |
| `NO_COLOR` | Disable the coloured banner. | (unset) |

The CLI also honours each editor's own config-location override (e.g. `CLAUDE_CONFIG_DIR`,
`CODEX_HOME`, `GEMINI_DIR`, plus `APPDATA` / `LOCALAPPDATA` / `XDG_CONFIG_HOME` on the relevant
platforms) when deciding where to write. See [Connecting your editor](./connecting-editors.md).

## Files

| Path | What |
|---|---|
| `~/.config/phaser-game-agent/config.json` | Your stored token, site, and MCP URL (mode `0600`). |
| `<editor config>.bak-pga` | A backup written next to each editor config before it's modified. |

## Examples

```bash
# Configure just Cursor
phaser-game-agent setup --tool cursor

# Configure everything the CLI knows about
phaser-game-agent setup --tool all

# Sign in without a browser (paste a token from your account page)
phaser-game-agent login --token pga_xxxxxxxxxxxxxxxx

# Print config to paste into an editor we don't list
phaser-game-agent manual

# Point at a self-hosted / staging endpoint
PHASER_AGENT_MCP_URL=https://mcp.example.dev/agent/mcp phaser-game-agent setup --tool cursor

# Check state
phaser-game-agent status
```
