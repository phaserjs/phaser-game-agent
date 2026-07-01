# Troubleshooting

Start with the basics: **did you restart the editor after configuring?** MCP servers are read at
startup, so a config change won't take effect until you restart the editor/CLI.

Then run `phaser-game-agent status` — it shows whether you're signed in, whether you have access,
your credit balance, and which editors it thinks are configured.

## The tools don't show up in my agent

- **Restart the editor.** This is the fix ~80% of the time.
- Confirm the server was written: `phaser-game-agent status` should list the editor as
  `configured`.
- For **VS Code**, tools only appear in **Copilot Chat → Agent mode**. Run **"MCP: List Servers"**
  from the Command Palette to confirm it's registered. (And note: the Claude Code extension's MCP
  panel is a *different* list — it won't show this server.)
- For **bridge-based editors** (Codex, Cursor, Gemini CLI, Antigravity, Qoder, Windsurf), make sure
  you installed globally (`npm i -g @phaserjs/game-agent`) so the `bridge.mjs` path is valid.

## "401" / "missing token" / it lists no tools

The server requires your token even to list tools. This usually means the config has a URL but no
auth:

- Re-run `phaser-game-agent setup --tool <id>` (or the one-shot) to rewrite it correctly.
- If you added it manually, check the `Authorization: Bearer …` header (native HTTP) or the
  `PHASER_GAME_AGENT_TOKEN` env var (bridge) is present — see [Manual setup](./manual-setup.md).
- If it *was* working and suddenly 401s, your token may have been revoked. Run
  `phaser-game-agent login` again — it re-pushes a fresh token to every configured editor.

## "No agent access" / builds fail for lack of credits

Your Phaser account needs a subscription or credits. `phaser-game-agent status` shows your access
and balance; the CLI menu's **Show Credits Balance and Transactions** option (or asking your agent
*"show my credits"*) gives you a buy-more link.

## The account check greets me but builds fail

That means auth is fine but something downstream failed — usually credits (see above) or a
transient sandbox issue. Ask your agent to retry, or *"show my credits"* to rule out balance.

## I signed in again and now an editor uses an old token

It shouldn't — `login` automatically re-pushes the new token into everything already configured. If
one still has an old token (e.g. you edited it by hand), run `phaser-game-agent setup --tool <id>`
or use the menu's **Refresh your token across configured agents**.

## The bridge / global install

Bridge-based editors store an **absolute path** to `bridge.mjs`. If you ran the one-shot via `npx`
and later cleared your npm cache, that path can vanish. Fix: install globally and reconfigure:

```bash
npm i -g @phaserjs/game-agent
phaser-game-agent setup --tool <id>
```

## Sign-in / browser doesn't open

- No browser environment? Sign in with a pasted token instead:
  `phaser-game-agent login --token pga_xxxx` (copy one from your Phaser account page).
- If the browser opens but the flow hangs, make sure nothing is blocking the short-lived local
  callback server the CLI starts on `127.0.0.1`.

## My editor isn't detected

Detection is deliberately conservative (it looks for the actual binary/app, not just a leftover
config directory, to avoid false positives). If your editor is installed but not offered:

- Configure it explicitly: `phaser-game-agent setup --tool <id>`.
- Or, if it's not in the list at all, use [Manual setup](./manual-setup.md) /
  `phaser-game-agent manual`.

## Where things live / undoing changes

- Your token: `~/.config/phaser-game-agent/config.json`.
- Every edited editor config gets a `*.bak-pga` backup written next to it before changes.
- `phaser-game-agent logout` removes the `phaser-game-agent` entry from every editor and clears your
  stored token. To fully revoke a token server-side, do it from your Phaser account settings.

## Still stuck?

Open an issue at
[github.com/phaserjs/phaser-game-agent/issues](https://github.com/phaserjs/phaser-game-agent/issues)
with your OS, editor + version, and the output of `phaser-game-agent status`.
